

const trackedInputs = new Set();
const lastCapturedValues = new WeakMap();

if (!window.flowRecorder) {
    window.flowRecorder = {
        isRecording: false,
    };
}

const pendingInputs = new Map();

function saveStep(step) {
    chrome.runtime.sendMessage({
        action: "RECORD_STEP",
        step,
    });
}

function captureInput(element) {
    if (
        element instanceof HTMLInputElement &&
        ["password", "hidden", "file"].includes(element.type)
    ) {
        return;
    }

    let value;

    if (element instanceof HTMLInputElement && element.type === "checkbox") {
        value = element.checked;
    } else {
        value = element.value;
    }

    if (lastCapturedValues.get(element) === value) {
        return;
    }

    lastCapturedValues.set(element, value);

    const step = {
        type: "input",
        tag: element.tagName.toLowerCase(),
        selector: getSelector(element),
        value,
        inputType: element instanceof HTMLInputElement
            ? element.type
            : undefined,
        timestamp: Date.now(),
    };

    saveStep(step);
}

function handleInput(event) {
    const element = event.target;

    if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        !(element instanceof HTMLSelectElement)
    ) {
        return;
    }

    // Ignore sensitive inputs
    if (
        element instanceof HTMLInputElement &&
        ["password", "hidden", "file"].includes(element.type)
    ) {
        return;
    }

    trackedInputs.add(element);

    // Ignore unchecked radio buttons
    if (
        element instanceof HTMLInputElement &&
        element.type === "radio" &&
        !element.checked
    ) {
        return;
    }

    // Capture dropdowns, radio buttons and checkboxes immediately
    if (
        element instanceof HTMLSelectElement ||
        (
            element instanceof HTMLInputElement &&
            ["radio", "checkbox"].includes(element.type)
        )
    ) {
        captureInput(element);
        return;
    }

    clearTimeout(pendingInputs.get(element));

    const timer = setTimeout(() => {
        captureInput(element);
        pendingInputs.delete(element);
    }, 500);

    pendingInputs.set(element, timer);
}

function flushPendingInputs() {
    for (const [element, timer] of pendingInputs) {
        clearTimeout(timer);
        captureInput(element);
    }

    pendingInputs.clear();
}

function getSelector(element) {
    // Give each radio button a unique selector
    if (
        element instanceof HTMLInputElement &&
        element.type === "radio"
    ) {
        return `input[name="${CSS.escape(element.name)}"][value="${CSS.escape(element.value)}"]`;
    }

    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }

    if (element.getAttribute("data-testid")) {
        return `[data-testid="${CSS.escape(
            element.getAttribute("data-testid")
        )}"]`;
    }

    if (element.name) {
        return `${element.tagName.toLowerCase()}[name="${CSS.escape(
            element.name
        )}"]`;
    }

    // Build a CSS path using element positions
    const path = [];

    let current = element;

    while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();

        const parent = current.parentElement;

        if (!parent) break;

        const siblings = Array.from(parent.children).filter(
            child => child.tagName === current.tagName
        );

        if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
        }

        path.unshift(selector);

        current = parent;
    }

    return path.join(" > ");
}

function handleClick(event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const element = target.closest("button");

    if (!element) return;

    // Capture edited fields first
    for (const input of trackedInputs) {
        captureInput(input);
    }

    const step = {
        type: "click",
        tag: "button",
        selector: getSelector(element),
        text: element.innerText.trim(),
        timestamp: Date.now(),
    };

    saveStep(step);
}

function startRecording() {
    if (window.flowRecorder.isRecording) return;

    document.addEventListener("change", handleInput, true);
    document.addEventListener("click", handleClick, true);

    window.flowRecorder.isRecording = true;
}

function stopRecording() {
    if (!window.flowRecorder.isRecording) return;

    flushPendingInputs();

    document.removeEventListener("change", handleInput, true);
    document.removeEventListener("click", handleClick, true);

    window.flowRecorder.isRecording = false;
}

async function replayWorkflow(steps) {
    for (let index = 0; index < steps.length; index++) {
        const step = steps[index];

        try {
            const element = document.querySelector(step.selector);

            if (!element) {
                throw new Error(`Element not found: ${step.selector}`);
            }

            if (step.type === "input") {
                // Checkbox
                if (
                    element instanceof HTMLInputElement &&
                    element.type === "checkbox"
                ) {
                    element.checked = Boolean(step.value);

                    element.dispatchEvent(
                        new Event("input", { bubbles: true })
                    );

                    element.dispatchEvent(
                        new Event("change", { bubbles: true })
                    );
                }

                // Radio button
                else if (
                    element instanceof HTMLInputElement &&
                    element.type === "radio"
                ) {
                    element.checked = true;

                    element.dispatchEvent(
                        new Event("input", { bubbles: true })
                    );

                    element.dispatchEvent(
                        new Event("change", { bubbles: true })
                    );
                }

                // Text input, textarea and dropdown
                else if (
                    element instanceof HTMLInputElement ||
                    element instanceof HTMLTextAreaElement ||
                    element instanceof HTMLSelectElement
                ) {
                    let prototype;

                    if (element instanceof HTMLTextAreaElement) {
                        prototype = HTMLTextAreaElement.prototype;
                    } else if (element instanceof HTMLSelectElement) {
                        prototype = HTMLSelectElement.prototype;
                    } else {
                        prototype = HTMLInputElement.prototype;
                    }

                    const valueSetter = Object.getOwnPropertyDescriptor(
                        prototype,
                        "value"
                    ).set;

                    valueSetter.call(element, step.value);

                    element.dispatchEvent(
                        new Event("input", { bubbles: true })
                    );

                    element.dispatchEvent(
                        new Event("change", { bubbles: true })
                    );
                } else {
                    throw new Error("Unsupported element type");
                }
            }

            await wait(500);
        } catch (error) {
            return {
                success: false,
                failedStep: index + 1,
                message: error.message
            };
        }
    }

    return {
        success: true,
        message: "Workflow replay completed. Please review the populated fields before submitting."
    };
}

function updateWorkflow(steps) {
    try {
        if (!Array.isArray(steps) || steps.length === 0) {
            throw new Error("No saved workflow steps found.");
        }

        const updatedSteps = steps.map((step) => {
            // Keep click steps unchanged
            if (step.type !== "input") {
                return step;
            }

            const element = document.querySelector(step.selector);

            if (!element) {
                throw new Error(`Element not found: ${step.selector}`);
            }

            const updatedStep = {
                ...step,
                timestamp: Date.now(),
            };

            // Checkbox
            if (
                element instanceof HTMLInputElement &&
                element.type === "checkbox"
            ) {
                updatedStep.value = element.checked;
            }

            // Radio button: find the currently selected option
            else if (
                element instanceof HTMLInputElement &&
                element.type === "radio"
            ) {
                const selectedRadio = document.querySelector(
                    `input[type="radio"][name="${CSS.escape(element.name)}"]:checked`
                );

                if (!selectedRadio) {
                    throw new Error(
                        `No selected option found for radio group: ${element.name}`
                    );
                }

                updatedStep.selector = getSelector(selectedRadio);
                updatedStep.value = selectedRadio.value;
            }

            // Text input, textarea and dropdown
            else if (
                element instanceof HTMLInputElement ||
                element instanceof HTMLTextAreaElement ||
                element instanceof HTMLSelectElement
            ) {
                updatedStep.value = element.value;
            } else {
                throw new Error(`Unsupported element: ${step.selector}`);
            }

            return updatedStep;
        });

        return {
            success: true,
            steps: updatedSteps,
            message: "Current form values captured successfully.",
        };

    } catch (error) {
        return {
            success: false,
            message: error.message,
        };
    }
}



function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "START_RECORDING") {
        startRecording();
        sendResponse({ success: true });
    }

    if (message.action === "STOP_RECORDING") {
        stopRecording();
        sendResponse({ success: true });
    }

    if (message.action === "PING") {
        sendResponse({ success: true });
    }

    if (message.action === "REPLAY_WORKFLOW") {
        const currentPageKey = window.location.origin + window.location.pathname;

        if (currentPageKey !== message.pageKey) {
            sendResponse({
                success: false,
                message: "Replay blocked: This workflow belongs to a different page.",
            });
            return;
        }

        replayWorkflow(message.steps).then(sendResponse);
        return true;
    }

    if (message.action === "UPDATE_WORKFLOW") {
        const result = updateWorkflow(message.steps);
        sendResponse(result);
    }



});
