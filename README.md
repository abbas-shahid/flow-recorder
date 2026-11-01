# FlowRecorder

**Record, save, update, and replay browser workflows — without repeatedly filling out the same forms.**

FlowRecorder is a Chrome extension built to simplify repetitive browser-based form testing. It allows developers and QA engineers to record interactions with form fields, save those workflows for individual pages, and replay them whenever needed.

Instead of manually entering the same information every time you test a form, you can record the process once and replay it whenever you need it.

**Repository:** https://github.com/shahidabbas37/flow-recorder

---

## The Problem

Developers and QA engineers frequently work with web applications containing complex forms, registration flows, administrative panels, dashboards, and data-entry pages.

During development and testing, these forms often need to be filled out repeatedly.

For example:

- Testing a user registration form with multiple input fields.
- Creating organizations and assigning existing users.
- Testing forms containing dropdowns, checkboxes, radio buttons, and textareas.
- Repeating the same form submission process after fixing a bug.
- Testing conditional fields that appear based on previous selections.
- Verifying that form values are populated correctly after application changes.

Manually entering the same information every time is repetitive, time-consuming, and inefficient.

This becomes even more frustrating when a workflow contains many fields or requires navigating through multiple pages.

## The Solution

FlowRecorder provides a simple way to record and replay these repetitive browser interactions.

You can:

1. Open any supported website.
2. Start recording from the FlowRecorder Chrome extension.
3. Interact with the form as you normally would.
4. Stop recording to save the workflow.
5. Replay the saved workflow whenever you need it.

Each workflow is associated with a specific website origin and page path.

You can independently record workflows for different pages and websites. You can also update an existing workflow when your test data changes or clear it when it is no longer needed.

**Record once. Replay whenever needed. Spend less time repeating manual form interactions.**

---

## Demo

Watch FlowRecorder in action:

- [Watch the FlowRecorder demo (MP4)](docs/videos/recorder-flow.mp4)

## Screenshots

### 1. Recording a workflow

![FlowRecorder recording](docs/screenshots/1%20recording.png)

### 2. Recording form interactions

![FlowRecorder recording form interactions](docs/screenshots/2%20recording.png)

### 3. Updating an existing workflow

![Update workflow](docs/screenshots/3%20update-recodring.png)

### 4. Clearing a saved workflow

![Clear workflow](docs/screenshots/4%20clear.png)

### 5. Replaying a workflow and automatically filling a form

![Replay and auto-fill form](docs/screenshots/5%20auto%20replay%20fill%20form.png)

---

## Features

### Workflow Recording

- Record interactions with form fields on a webpage.
- Capture text input, email, number fields, textareas, dropdowns, checkboxes, and radio buttons.
- Capture supported button interactions.
- Automatically save recorded steps.
- Stop recording whenever you finish the workflow.

### Workflow Management

- Save workflows independently for different pages.
- Identify workflows using the website origin and page pathname.
- Update an existing workflow with new form values.
- Clear a saved workflow without affecting workflows belonging to other pages.
- Prevent accidental overwriting of an existing workflow when starting a new recording.

### Workflow Replay

- Replay previously recorded form interactions.
- Automatically populate supported form controls.
- Handle conditional fields that appear after a previous selection.
- Support dropdowns whose options depend on existing application data.
- Validate the current page before replaying a workflow.
- Report replay failures when recorded elements or options are no longer available.

### Privacy and Storage

- Store workflows locally using Chrome Storage.
- No backend server or external database is required.
- Password, hidden, and file input fields are excluded from recording by default.
- Recorded workflows remain in the browser's local extension storage.

---

## How Workflow Identification Works

FlowRecorder identifies a workflow using:

**Website Origin + Page Pathname**

For example:

| Website page | Workflow |
|---|---|
| `http://localhost:5173/` | Workflow A |
| `http://localhost:5173/users` | Workflow B |
| `http://localhost:5173/organizations` | Workflow C |
| `http://localhost:5174/` | Workflow D |

This means:

- Different websites have separate workflows.
- Different paths on the same website have separate workflows.
- Query parameters and URL hashes are ignored.
- Multiple forms or popup dialogs on the same URL share the same page workflow.

For example, a login and signup popup on the same page will use the same workflow because opening the popup does not change the URL.

**Important:** Each page has its own recording process. FlowRecorder does not automatically continue recording when navigation moves to another page. You can start a separate workflow on the destination page.

---

## Technology Stack

FlowRecorder is built using the following technologies:

| Technology | Purpose |
|---|---|
| React | Extension popup interface |
| TypeScript | Type-safe popup development |
| JavaScript | Browser content script and workflow logic |
| Vite | Development and production build tooling |
| Chrome Extension Manifest V3 | Chrome extension architecture |
| Chrome Storage API | Local workflow persistence |
| Chrome Tabs API | Active tab and page management |
| Chrome Scripting API | Content script injection |
| HTML / CSS | User interface and form interaction |

### Architecture Overview

FlowRecorder uses a lightweight Chrome extension architecture.

**1. Popup UI — React + TypeScript**

The popup provides the interface for starting and stopping recordings, replaying workflows, updating existing workflows, and clearing saved workflows.

**2. Content Script — JavaScript**

The content script runs inside the active webpage. It listens for supported user interactions, captures form values, and performs replay operations.

**3. Background Service Worker — JavaScript**

The background service worker manages recording sessions, workflow identification, communication between the popup and content scripts, and replay validation.

**4. Local Storage — Chrome Storage API**

Recorded workflows are stored locally using `chrome.storage.local`. No backend API or remote database is involved.

---

## Installation and Setup

Follow these steps to run FlowRecorder locally.

### Prerequisites

Make sure you have:

- Google Chrome
- Node.js
- npm
- Git

### 1. Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/shahidabbas37/flow-recorder.git
```

Navigate into the project:

```bash
cd flow-recorder
```

### 2. Install Dependencies

Install the project dependencies:

```bash
npm install
```

### 3. Build the Extension

Generate the production build:

```bash
npm run build
```

Vite will generate the production files inside the `dist` directory.

### 4. Open Chrome Extensions

Open Google Chrome and navigate to:

```text
chrome://extensions/
```

### 5. Enable Developer Mode

1. Find the **Developer mode** toggle in the top-right corner.
2. Enable Developer mode.

### 6. Load the Extension

1. Click **Load unpacked**.
2. Navigate to your cloned FlowRecorder project.
3. Select the generated `dist` folder.
4. Chrome will load FlowRecorder as an unpacked extension.

### 7. Pin FlowRecorder

1. Click the Extensions icon in the Chrome toolbar.
2. Find FlowRecorder.
3. Click the pin icon to keep it visible in your toolbar.

**Installation is complete!**

---

## How to Use FlowRecorder

### 1. Open Any Website

Navigate to the website and page containing the form you want to test.

### 2. Open FlowRecorder

Click the FlowRecorder extension icon in your Chrome toolbar.

### 3. Start Recording

Click **Start Recording**.

FlowRecorder will begin capturing supported form interactions on the active page.

### 4. Interact With the Form

Fill out the form normally.

For example:

- Enter text and email addresses.
- Enter numeric values.
- Select dropdown options.
- Check or uncheck checkboxes.
- Select radio buttons.
- Interact with conditional form fields.
- Click supported buttons.

### 5. Stop Recording

Once you finish interacting with the form, open FlowRecorder again and click **Stop Recording**.

Your workflow will be saved locally.

### 6. Replay the Workflow

Whenever you want to repeat the same interactions:

1. Return to the same website and page.
2. Open FlowRecorder.
3. Click **Replay**.

FlowRecorder will attempt to populate the recorded form values automatically.

### 7. Update an Existing Workflow

If you want to change the values in an existing workflow:

1. Open the page containing the saved workflow.
2. Change the form values as needed.
3. Click **Update Workflow**.
4. Confirm the update.

The existing workflow will be updated with the current supported form values.

### 8. Clear a Workflow

If you no longer need a saved workflow:

1. Open the relevant page.
2. Open FlowRecorder.
3. Click **Clear Workflow**.
4. Confirm the deletion.

Only the workflow associated with the current page will be cleared.

---

## Important Notes and Limitations

FlowRecorder is an educational project and a practical starting point for browser workflow automation. It is not intended to replace dedicated end-to-end testing frameworks.

Please keep the following behavior in mind:

- Only one recording session can be active globally at a time.
- Each page requires its own independently recorded workflow.
- Query parameters and URL hashes are ignored when identifying workflows.
- Multiple popup forms on the same URL share one workflow.
- Password, hidden, and file input fields are excluded by default.
- Replay depends on the recorded elements and their selectors remaining available on the page.
- If a recorded element or dropdown option is missing, replay can report a failure.
- Button interactions can be recorded, but recorded clicks are not automatically executed during replay.
- Some highly dynamic websites may require additional handling for reliable replay.

For best results, make sure the page and its required data are available before replaying.

---

## Privacy

FlowRecorder is designed to keep recorded workflow data local to the browser.

- Workflows are stored using `chrome.storage.local`.
- No external backend is used.
- No external database is required.
- Sensitive password, hidden, and file input values are excluded by default.

Only record test data that you are comfortable storing in your browser's extension storage. Avoid recording real passwords, personal information, or confidential production data.

---

## Contributing

Contributions, suggestions, and improvements are welcome!

If you find a bug or have an idea for improving FlowRecorder:

1. Fork the repository.
2. Create a new branch for your changes.
3. Make your changes and test them.
4. Commit and push your changes.
5. Open a Pull Request with a description of your improvements.

You can also open an issue to report bugs or suggest new features.

---

## Project Purpose and Copyright

FlowRecorder is an independent project developed for **learning, experimentation, and portfolio purposes**.

The goal of this project is to explore Chrome extension development, browser APIs, DOM interaction, workflow recording, and replay functionality.

This project is not affiliated with Google or any other third-party website or service.

All rights to the original project code and assets are reserved by their respective owners unless otherwise stated. No open-source license has been granted at this time.

You are welcome to explore the project, provide feedback, and contribute through GitHub.

---

## Author

**Shahid Abbas**

- GitHub: [@shahidabbas37](https://github.com/shahidabbas37)
- LinkedIn: [Shahid Abbas](https://linkedin.com/in/shahid-abbas-676191173)

---

**If you find FlowRecorder useful, consider giving the repository a star!**