
let recordStepQueue = Promise.resolve();

// Get a consistent identifier for a page.
// Query parameters and URL hashes are intentionally ignored.
function getPageKey(url) {
    const pageUrl = new URL(url);
    return pageUrl.origin + pageUrl.pathname;
}

// Support workflows created by the previous origin-only version.
// Old workflows without a pathname are treated as root-page workflows.
function normalizeWorkflows(workflows) {
    return workflows.map((workflow) => ({
        ...workflow,
        pageKey: workflow.pageKey || (
            workflow.origin ? `${workflow.origin}/` : ""
        ),
    }));
}

async function getWorkflows() {
    const result = await chrome.storage.local.get("workflows");
    const workflows = normalizeWorkflows(result.workflows || []);

    return workflows;
}

// Find the most recently updated workflow for a page.
function findWorkflow(workflows, pageKey) {
    return workflows
        .filter((workflow) => workflow.pageKey === pageKey)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}

// Ensure the content script is available.
async function ensureContentScript(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            action: "PING",
        });
    } catch {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content/recorder.js"],
        });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // START RECORDING
    if (message.action === "START_RECORDING") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
                const tab = tabs[0];

                if (!tab?.id || !tab.url || !tab.url.startsWith("http")) {
                    sendResponse({
                        success: false,
                        message: "Please open a normal website before recording.",
                    });
                    return;
                }

                try {
                    const pageKey = getPageKey(tab.url);

                    const storage = await chrome.storage.local.get("isRecording");

                    if (storage.isRecording === true) {
                        sendResponse({
                            success: false,
                            message: "Another recording is already active.",
                        });
                        return;
                    }

                    const workflows = await getWorkflows();

                    const existingWorkflow = findWorkflow(workflows, pageKey);

                    // Never overwrite an existing workflow by starting a new recording.
                    if (existingWorkflow) {
                        sendResponse({
                            success: false,
                            message: "A workflow already exists for this page. Use Update Workflow to update its values.",
                        });
                        return;
                    }

                    const pageUrl = new URL(tab.url);

                    const workflow = {
                        id: crypto.randomUUID(),
                        pageKey,
                        origin: pageUrl.origin,
                        path: pageUrl.pathname,
                        steps: [],
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };

                    workflows.push(workflow);

                    await chrome.storage.local.set({
                        workflows,
                        isRecording: true,
                        recordingTabId: tab.id,
                        recordingPageKey: pageKey,
                        activeWorkflowId: workflow.id,
                        recordedSteps: [],
                        recordingError: null,
                    });

                    await ensureContentScript(tab.id);

                    await chrome.tabs.sendMessage(tab.id, {
                        action: "START_RECORDING",
                    });

                    sendResponse({
                        success: true,
                        message: "Recording started.",
                    });

                } catch {
                    await chrome.storage.local.set({
                        isRecording: false,
                    });

                    await chrome.storage.local.remove([
                        "recordingTabId",
                        "recordingPageKey",
                        "activeWorkflowId",
                    ]);

                    sendResponse({
                        success: false,
                        message: "Could not start recording.",
                    });
                }
            }
        );

        return true;
    }

    // STOP RECORDING
    if (message.action === "STOP_RECORDING") {
        chrome.storage.local.get("recordingTabId", async (result) => {
            try {
                if (typeof result.recordingTabId === "number") {
                    try {
                        await chrome.tabs.sendMessage(result.recordingTabId, {
                            action: "STOP_RECORDING",
                        });
                    } catch {
                        // The recording tab may already be closed.
                    }
                }

                // Wait for pending recorded steps before stopping the session.
                await recordStepQueue;

                await chrome.storage.local.set({
                    isRecording: false,
                });

                await chrome.storage.local.remove([
                    "recordingTabId",
                    "recordingPageKey",
                    "activeWorkflowId",
                ]);

                sendResponse({
                    success: true,
                    message: "Recording stopped.",
                });

            } catch {
                sendResponse({
                    success: false,
                    message: "Could not stop recording.",
                });
            }
        });

        return true;
    }

    // SAVE RECORDED STEP
    if (message.action === "RECORD_STEP") {
        recordStepQueue = recordStepQueue.then(async () => {
            const result = await chrome.storage.local.get([
                "workflows",
                "activeWorkflowId",
                "recordingTabId",
                "recordingPageKey",
                "isRecording",
            ]);

            if (
                result.isRecording !== true ||
                sender.tab?.id !== result.recordingTabId
            ) {
                return;
            }

            const senderUrl = sender.tab?.url;

            if (
                !senderUrl ||
                getPageKey(senderUrl) !== result.recordingPageKey
            ) {
                return;
            }

            const workflows = normalizeWorkflows(result.workflows || []);

            const workflow = workflows.find(
                (item) => item.id === result.activeWorkflowId
            );

            if (!workflow) {
                return;
            }

            workflow.steps.push(message.step);
            workflow.updatedAt = Date.now();

            await chrome.storage.local.set({
                workflows,
                recordedSteps: workflow.steps,
            });
        }).catch(async () => {
            await chrome.storage.local.set({
                recordingError: "Could not save a recorded step.",
            });
        });
    }

    // GET WORKFLOW FOR CURRENT PAGE
    if (message.action === "GET_CURRENT_WORKFLOW") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
                const tab = tabs[0];

                if (!tab?.id || !tab.url || !tab.url.startsWith("http")) {
                    sendResponse({
                        success: false,
                        message: "Please open a normal website.",
                        workflow: null,
                        steps: [],
                    });
                    return;
                }

                try {
                    const pageKey = getPageKey(tab.url);
                    const workflows = await getWorkflows();
                    const workflow = findWorkflow(workflows, pageKey);

                    sendResponse({
                        success: true,
                        workflow: workflow || null,
                        steps: workflow?.steps || [],
                    });

                } catch {
                    sendResponse({
                        success: false,
                        message: "Could not load workflow.",
                        workflow: null,
                        steps: [],
                    });
                }
            }
        );

        return true;
    }

    // REPLAY WORKFLOW
    if (message.action === "REPLAY_WORKFLOW") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
                const tab = tabs[0];

                if (!tab?.id || !tab.url || !tab.url.startsWith("http")) {
                    sendResponse({
                        success: false,
                        message: "Please open a normal website before replaying.",
                    });
                    return;
                }

                try {
                    const pageKey = getPageKey(tab.url);
                    const workflows = await getWorkflows();
                    const workflow = findWorkflow(workflows, pageKey);

                    if (!workflow) {
                        sendResponse({
                            success: false,
                            message: "No saved workflow exists for this page.",
                        });
                        return;
                    }

                    if (workflow.steps.length === 0) {
                        sendResponse({
                            success: false,
                            message: "This workflow has no recorded steps.",
                        });
                        return;
                    }

                    await ensureContentScript(tab.id);

                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: "REPLAY_WORKFLOW",
                        steps: workflow.steps,
                        pageKey,
                    });

                    sendResponse(response);

                } catch {
                    sendResponse({
                        success: false,
                        message: "Could not replay workflow.",
                    });
                }
            }
        );

        return true;
    }

    // UPDATE WORKFLOW
    if (message.action === "UPDATE_WORKFLOW") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
                const tab = tabs[0];

                if (!tab?.id || !tab.url || !tab.url.startsWith("http")) {
                    sendResponse({
                        success: false,
                        message: "Please open the website containing your workflow.",
                    });
                    return;
                }

                try {
                    const pageKey = getPageKey(tab.url);
                    const workflows = await getWorkflows();
                    const workflow = findWorkflow(workflows, pageKey);

                    if (!workflow) {
                        sendResponse({
                            success: false,
                            message: "No saved workflow exists for this page.",
                        });
                        return;
                    }

                    await ensureContentScript(tab.id);

                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: "UPDATE_WORKFLOW",
                        steps: workflow.steps,
                    });

                    if (!response?.success) {
                        sendResponse(response || {
                            success: false,
                            message: "Could not read current form values.",
                        });
                        return;
                    }

                    const workflowIndex = workflows.findIndex(
                        (item) => item.id === workflow.id
                    );

                    workflows[workflowIndex] = {
                        ...workflow,
                        steps: response.steps,
                        updatedAt: Date.now(),
                    };

                    await chrome.storage.local.set({
                        workflows,
                        recordedSteps: response.steps,
                    });

                    sendResponse({
                        success: true,
                        message: "Workflow updated successfully.",
                    });

                } catch {
                    sendResponse({
                        success: false,
                        message: "Could not update workflow.",
                    });
                }
            }
        );

        return true;
    }


    // CLEAR WORKFLOW FOR CURRENT PAGE
    if (message.action === "CLEAR_WORKFLOW") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
                const tab = tabs[0];

                if (!tab?.id || !tab.url || !tab.url.startsWith("http")) {
                    sendResponse({
                        success: false,
                        message: "Please open the website containing your workflow.",
                    });
                    return;
                }

                try {
                    const storage = await chrome.storage.local.get("isRecording");

                    if (storage.isRecording === true) {
                        sendResponse({
                            success: false,
                            message: "Stop recording before clearing a workflow.",
                        });
                        return;
                    }

                    const pageKey = getPageKey(tab.url);
                    const workflows = await getWorkflows();

                    const updatedWorkflows = workflows.filter(
                        (workflow) => workflow.pageKey !== pageKey
                    );

                    if (updatedWorkflows.length === workflows.length) {
                        sendResponse({
                            success: false,
                            message: "No workflow exists for this page.",
                        });
                        return;
                    }

                    await chrome.storage.local.set({
                        workflows: updatedWorkflows,
                        recordedSteps: [],
                    });

                    sendResponse({
                        success: true,
                        message: "Workflow cleared successfully.",
                    });

                } catch {
                    sendResponse({
                        success: false,
                        message: "Could not clear workflow.",
                    });
                }
            }
        );

        return true;
    }

});

// RESUME RECORDING AFTER PAGE REFRESH
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
        return;
    }

    try {
        const result = await chrome.storage.local.get([
            "isRecording",
            "recordingTabId",
            "recordingPageKey",
        ]);

        if (
            result.isRecording !== true ||
            result.recordingTabId !== tabId
        ) {
            return;
        }

        if (!tab.url || !tab.url.startsWith("http")) {
            return;
        }

        // Resume only on the original page.
        if (getPageKey(tab.url) !== result.recordingPageKey) {
            await chrome.storage.local.set({
                isRecording: false,
            });

            await chrome.storage.local.remove([
                "recordingTabId",
                "recordingPageKey",
                "activeWorkflowId",
            ]);

            return;
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content/recorder.js"],
        });

        await chrome.tabs.sendMessage(tabId, {
            action: "START_RECORDING",
        });

    } catch {
        await chrome.storage.local.set({
            recordingError: "Could not resume recording after the page refreshed.",
        });
    }
});

// STOP RECORDING IF ITS TAB IS CLOSED
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const result = await chrome.storage.local.get([
        "isRecording",
        "recordingTabId",
    ]);

    if (
        result.isRecording === true &&
        result.recordingTabId === tabId
    ) {
        await recordStepQueue;

        await chrome.storage.local.set({
            isRecording: false,
        });

        await chrome.storage.local.remove([
            "recordingTabId",
            "recordingPageKey",
            "activeWorkflowId",
        ]);
    }
});
