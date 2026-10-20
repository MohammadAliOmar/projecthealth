# ProjectHealth AI — Capstone Project Early Warning Dashboard

> An early warning analytics and intervention platform helping university lecturers identify student group projects at risk before critical milestones fail.

---

## Table of Contents

- [PART I: USER SETUP & OPERATING MANUAL (BEGINNER'S GUIDE)](#part-i-user-setup--operating-manual-beginners-guide)
  - [1. Introduction & Overview](#1-introduction--overview)
  - [2. Prerequisites & System Requirements](#2-prerequisites--system-requirements)
  - [3. Submitting & Extracting Project Files](#3-submitting--extracting-project-files)
  - [4. Step-by-Step Installation Instructions](#4-step-by-step-installation-instructions)
  - [5. Running the Application](#5-running-the-application)
  - [6. Step-by-Step User Walkthrough (GUI Guide)](#6-step-by-step-user-walkthrough-gui-guide)
  - [7. Troubleshooting Common Issues](#7-troubleshooting-common-issues)
  - [8. Quick Verification Checklist](#8-quick-verification-checklist)
- [PART II: TECHNICAL IMPLEMENTATION DOCUMENT (TID)](#part-ii-technical-implementation-document-tid)
  - [1. Document Purpose & Project Goals](#1-document-purpose--project-goals)
  - [2. Architectural Overview & System Design](#2-architectural-overview--system-design)
  - [3. Technology Stack](#3-technology-stack)
  - [4. Core Modules & Key Programming Functions](#4-core-modules--key-programming-functions)
  - [5. Implementation Strategy & Design Patterns](#5-implementation-strategy--design-patterns)
  - [6. System Configuration & Deployment](#6-system-configuration--deployment)
  - [7. Testing & Validation Methodologies](#7-testing--validation-methodologies)
  - [8. Engineering Challenges & Implemented Solutions](#8-engineering-challenges--implemented-solutions)
  - [9. Future Enhancements & Scalability](#9-future-enhancements--scalability)
  - [10. Conclusion & Acknowledgments](#10-conclusion--acknowledgments)

---

# PART I: USER SETUP & OPERATING MANUAL (BEGINNER'S GUIDE)

## 1. Introduction & Overview

**ProjectHealth AI** is a web-based pedagogical management tool designed specifically for university lecturers, course coordinators, and teaching assistants. 

### What the Application Does
In university capstone and software engineering courses, student teams often experience silent dysfunction: unequal workload, uncommunicative members, missed sprint deliverables, or technical blockers. Lecturers usually only discover these problems at midterm or final grading when it is too late to intervene.

**ProjectHealth AI solves this problem by:**
1. **Connecting Directly to Asana Projects**: Pulls tasks, deadlines, and members via Asana Project IDs or URLs.
2. **Computing an Early Warning Health Score (0–100)**: Evaluates 5 core health factors (Task Completion, Overdue Tasks, Member Activity, Workload Balance, and Communication).
3. **Classifying Risk Levels**: Automatically tags teams as **Low Risk** (70–100), **Medium Risk** (40–69), or **High Risk** (<40).
4. **Providing Actionable Interventions**: Enables lecturers to dispatch targeted advisory notices directly to student teams, post notices to Asana boards, and launch pre-filled email messages.

---

## 2. Prerequisites & System Requirements

Before running the program on your local computer, make sure you have the following software installed:

| Requirement | Minimum Version | Description | Download Link |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18.0.0` or higher | JavaScript runtime environment to run the web server | [nodejs.org](https://nodejs.org/) |
| **npm** | `v9.0.0` or higher | Node Package Manager (included automatically with Node.js) | Included with Node |
| **Web Browser** | Latest version | Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari | Any modern browser |
| **Operating System** | Any | macOS, Windows 10/11, or Linux (Ubuntu, Debian, Fedora, etc.) | N/A |

> **Beginner Tip:** To check if you already have Node.js and npm installed, open your terminal (macOS/Linux) or Command Prompt/PowerShell (Windows) and run:
> ```bash
> node -v
> npm -v
> ```
> If version numbers appear (e.g., `v20.10.0` and `10.2.3`), you are ready to proceed.

---

## 3. Submitting & Extracting Project Files

### If Submitting the Project
When submitting your work for evaluation, package the repository as a standard `.zip` file:
1. Ensure the `node_modules` folder and `.git` folder are excluded to keep file sizes small.
2. Ensure `package.json`, `firebase-applet-config.json`, `firestore.rules`, and the `src/` folder are included.

### If Extracting a Submitted ZIP File
1. Download the submission `.zip` file to your computer (e.g., in your `Downloads` or `Projects` folder).
2. Right-click the `.zip` file and select **Extract All...** (Windows) or double-click to unzip (macOS).
3. Open your terminal and navigate (`cd`) into the extracted folder:
   ```bash
   cd path/to/extracted-folder
   ```

---

## 4. Step-by-Step Installation Instructions

Follow these numbered steps to configure your environment:

### Step 1: Open Terminal in the Project Root
Ensure you are in the directory containing `package.json`. You can verify this by running:
* **macOS/Linux**: `ls`
* **Windows**: `dir`

You should see files such as `package.json`, `vite.config.ts`, and `index.html`.

### Step 2: Install Required Dependencies
Run the following command to download all libraries and tools:
```bash
npm install
```
*This command will install React 19, Vite, Tailwind CSS, Lucide icons, Firebase SDK, and TypeScript compiler.*

---

## 5. Running the Application

### Step 1: Launch the Local Development Server
Execute the start command:
```bash
npm run dev
```

You will see output similar to:
```
  VITE v8.3.0  ready in 240 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://0.0.0.0:3000/
```

### Step 2: Open the Application in Your Browser
Open your web browser and navigate to:
```
http://localhost:3000
```

---

## 6. Step-by-Step User Walkthrough (GUI Guide)

### 1. Sign In or Create an Account
* **Sign Up**: Enter your Lecturer Name, Email, and Password (minimum 6 characters).
* **Sign In**: Log in using your email and password.
* **Security Protection**: If 5 incorrect passwords are typed consecutively, the system locks login for 15 minutes to prevent unauthorized access.
* **Forgot Password**: Click "Forgot Password?" and enter your email address to receive an official Firebase password reset link. The system always presents a consistent generic notification: *"If an account exists for that email, a reset link has been sent"*.

### 2. View the Lecturer Overview Dashboard
* **Summary Cards**: Displays Total Projects, High Risk (<40), Medium Risk (40–69), Low Risk (70+), and Class Average Health Score.
* **Search & Filters**: Search in real time by team name, project title, course code (e.g., `CAP-401`), or student name. Filter by risk tier or sort by lowest health first.

### 3. Add or Import a Student Asana Project
1. Click the **"Add Project from Asana"** button at the top right of the dashboard.
2. Enter the student team's **Asana Project ID** (e.g., `1208934759238475` or full Asana URL).
3. Enter the **Team Name** (e.g., `Social Media Campaign Platform`) and **Course Code** (e.g., `CAP-401`).
4. **Choose your evaluation mode**:
   * *Without an Asana token (simulated demo mode)*: Click **"Pull Data from Student ID & Calculate Health"**, or click one of the four **sample team** buttons (they fill in the form and assess the team automatically). The numbers are generated from the project ID, and the team is saved with a "Simulated" badge. Leave the token box empty for this mode: the button ignores a typed token, but a team saved while a token is in the box is marked live.
   * *With an Asana Personal Access Token (PAT)*: Paste your throwaway token. A separate **"Live Asana REST API"** button appears: click it to read the real project from Asana. Only teams added this way are saved as live ("Synced from Asana").
5. Review the preview metrics and click **"Add Project to Dashboard"**. Adding an ID that is already on the dashboard updates that team in place.

### 4. Deep-Dive into Project Health Details
Click any project card to open the **Group Details View**:
* **Factor Breakdown**: View exact points and weights for Task Completion ($30\%$), Overdue Tasks ($25\%$), Member Activity ($20\%$), Workload Equity ($15\%$), and Communication ($10\%$).
* **Team Members & Workload Equity**: View each student's assigned tasks, commits, PR reviews, and real contribution percentage share (computed from completed work using the largest-remainder method, totaling exactly $100\%$).
* **Diagnostic Risk Drivers**: Review plain-English explanations of why points were lost (e.g., *"3 Overdue Tasks Detected"* or *"Unequal Workload Distribution"*).

### 5. Send an Advisory Notice / Intervention
1. In the Group Details view or from the action menu, click **"Send Team Message"**.
2. Select target recipient (**"Entire Team"** or a specific student).
3. Enter the Subject and Message instructions.
4. To post to Asana, click **"Asana PAT Token Settings"** and paste your throwaway token (this dialog has its own token box). Then click **"Send & Dispatch Message"**:
   * With a token, posts an advisory notice to the Asana board without a due date, prefixed `[ProjectHealth AI] Lecturer advisory:`, and notifies student followers if known. Without a token nothing is posted: the dialog says *"Recorded only. Nothing was posted to Asana."*
   * Records a persistent entry in Cloud Firestore audit logs (`groups/{id}/messages`).
   * **Score Integrity Guarantee**: Dispatched advisories are excluded from all scoring inputs and never alter the team's Communication factor score (communication reflects student activity only).
   * Provides one-click shortcuts to compose in **Web Gmail** or your native email client (`mailto:`).

### 6. Synchronize Asana Updates
Scores are refreshed only when you click a Sync button: **"Sync with Asana"** in the top bar (all teams) or one of the sync buttons on a team's details page, such as **"Sync from Asana"** (one team).

* **Simulated teams** are regenerated from their project ID.
* **Live teams** (added with a token) need the token again, but no Sync button asks for it, so a live team shows *"Paste your Asana token to sync this project."* and keeps its last good data. Because the top-bar button treats all teams as one job, that message appears for every team while a live team is on the dashboard, and no team is updated. To refresh a live team, add it again with its token: the existing card is updated in place.
* If a live fetch fails, the last good data is preserved and a clear error is shown.

---

## 7. Troubleshooting Common Issues

| Issue / Error | Likely Cause | Solution |
| :--- | :--- | :--- |
| `port 3000 is already in use` | Another program or previous instance is running on port 3000. | Terminate the existing process or restart your terminal. |
| `Cannot find module` or build error | Missing dependencies after unzipping. | Run `npm install` in the project root directory. |
| Asana API fetch returns `401 Unauthorized` | Asana Personal Access Token is expired or invalid. | Generate a fresh PAT in Asana under *Developer App Console*, or use the direct evaluation mode. |
| "Paste your Asana token to sync this project." | The team was added with a token, so it is live, and the Sync buttons cannot send a token. | Add the team again with its token (the card updates in place). Until then the top-bar sync also fails for the other teams. |
| A simulated team's score is lower than yesterday | Simulated due dates are fixed when the team is added, while the on-time factor is recalculated against today's date. | Expected for sample data. Add the sample team again to reset it. |
| The alert bell is empty on another computer or browser | Alerts are kept in the browser's local storage, not in Firestore. | Expected in this prototype. Alerts are raised when a Medium or High Risk team is added. |
| Reset email not arriving | University firewall or spam filter delay. | Check the spam / junk folder for the Firebase reset email. |
| Blank screen on browser launch | Browser cache holding outdated scripts. | Press `Ctrl + F5` (Windows) or `Cmd + Shift + R` (macOS) to hard-refresh the page. |

---

## 8. Quick Verification Checklist

- [x] Node.js `v18+` installed and confirmed via `node -v`
- [x] Dependencies installed successfully via `npm install`
- [x] Application compiles with zero TypeScript errors via `npm run build`
- [x] Local server launched via `npm run dev` and reachable on `http://localhost:3000`
- [x] Can sign up / log in to lecturer workspace
- [x] Can add student project using Asana ID/URL
- [x] Can view multi-factor health scores and risk explanations
- [x] Can dispatch advisory messages to teams

---

# PART II: TECHNICAL IMPLEMENTATION DOCUMENT (TID)

## 1. Document Purpose & Project Goals

### Purpose of the Document
This Technical Implementation Document (TID) serves as the architectural and engineering specification for **ProjectHealth AI**. It outlines the system design, algorithmic scoring models, Asana integration mechanics, Firebase backend persistence, security boundaries, and automated testing verification.

### Problem Statement & Project Goals
In university computing and capstone courses, student teams operate in external project management tools (like Asana). Course coordinators lack continuous visibility into sprint execution. 

**System Goals:**
1. **Automate Early Risk Detection**: Ingest project metadata to compute pedagogical risk metrics before milestone submission deadlines.
2. **Transparent Multi-Factor Health Engine**: Replace subjective evaluation with an objective, mathematically grounded multi-factor formula.
3. **Multi-Tenant Lecturer Isolation**: Ensure lecturer workspaces and student rosters are strictly compartmentalized and persisted securely.
4. **Actionable Feedback Loop**: Enable one-click interventions directly connected to student communication channels.

---

## 2. Architectural Overview & System Design

The application utilizes a **Modern Full-Stack Single Page Application (SPA) Architecture** integrated with cloud backend services:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (BROWSER)                          │
├────────────────────────────────────────────────────────────────────────┤
│  React 19 + TypeScript + Tailwind CSS                                  │
│  ├── AuthenticationScreen (Firebase Auth + Security Lockout)           │
│  ├── LecturerDashboard (Summary Cards, Multi-filter Search, Sorting)   │
│  ├── GroupDetailsView (Health Breakdowns, Members, Task List)          │
│  ├── AddAsanaProjectModal (ID/URL Parser & Live Ingestion)             │
│  └── SendMessageModal (Multi-channel Advisory Dispatcher)              │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │                                        │
        REST API / OAuth                         SDK Events & Observables
                │                                        │
┌───────────────▼────────────────┐      ┌────────────────▼───────────────┐
│       EXTERNAL APIS            │      │        FIREBASE BACKEND        │
├────────────────────────────────┤      ├────────────────────────────────┤
│  Asana REST API v1.0           │      │  Cloud Firestore (Default DB)  │
│  ├── /projects/{id}            │      │  ├── /users/{uid}              │
│  ├── /projects/{id}/members    │      │  ├── /groups/{groupId}         │
│  ├── /projects/{id}/tasks      │      │  ├── /groups/{id}/messages     │
│  └── /projects/{id}/tasks POST │      │  └── /groups/{id}/history      │
└────────────────────────────────┘      │  Firebase Authentication       │
                                        │  └── Email/Password & Token    │
                                        └────────────────────────────────┘
```

### Architectural Principles
* **Pure Functional Scoring Engine**: The core scoring mathematics (`src/engine/scoring.ts`) are 100% pure functions with zero DOM or network dependencies.
* **Dual-Tier Resilient Persistence**:
  1. *Primary*: Cloud Firestore with fine-grained security rules.
  2. *Secondary Fallback*: Local cache keyed by lecturer identity (`projecthealth_{sanitized_email}_groups`, with the alerts under `projecthealth_{sanitized_email}_alerts`) ensuring offline capability and test stability. The cache is unencrypted (see Known Limitations in Section 8).
* **Optimistic UI Updates**: State mutations reflect immediately in the interface while asynchronous cloud operations resolve in the background.

---

## 3. Technology Stack

| Layer | Technology | Version | Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.0.1` | Concurrent rendering, declarative component hierarchy |
| **Language** | TypeScript | `^7.0.2` | Strict compile-time type safety across domain entities |
| **Styling** | Tailwind CSS | `^4.3.3` | Utility-first, responsive, lightweight design system |
| **Build Tool** | Vite | `^8.3.0` | Sub-second Hot Module Reload (HMR) and optimized build bundles |
| **Authentication** | Firebase Auth | `^12.19.0` | Industry-standard identity and token lifecycle management |
| **Database** | Cloud Firestore | `^12.19.0` | Real-time NoSQL document store with declarative rule security |
| **Icons & Visuals** | Lucide React | `^0.546.0` | Accessible and consistent iconography |
| **Test Runner** | Vitest on Node.js | `^5.0.3` | Headless unit tests for scoring, parsing and service logic (`npm test`) |

---

## 4. Core Modules & Key Programming Functions

### Module 1: Asana Ingestion & Member Synchronization (`src/services/asanaService.ts`)

#### Key Function: `extractAsanaProjectId(input: string): string`
Extracts valid Asana GIDs from arbitrary strings, full browser URLs, or internal identifiers.
```typescript
export function extractAsanaProjectId(input: string): string {
  if (!input) return '';
  let trimmed = input.trim();
  if (!trimmed) return '';

  // Strip leading grp- prefix if present
  if (trimmed.startsWith('grp-')) {
    trimmed = trimmed.substring(4);
  }

  // If pure digits
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Newer address form first: https://app.asana.com/1/{workspaceId}/project/{projectId}/...
  const newerMatch = trimmed.match(/asana\.com\/1\/\d+\/project\/(\d+)/i);
  if (newerMatch && newerMatch[1]) return newerMatch[1];

  // Generic /project/{projectId}, older /0/{projectId}/..., portfolio URLs and any
  // asana.com URL with a 6+ digit id are handled the same way (omitted here).

  // If no valid ID can be extracted, return an empty string (no hard-coded default project)
  return '';
}
```
* **Parameters**: `input` (`string`) — User input (e.g., URL, ID, or prefixed identifier).
* **Return Value**: `string` — Normalized numeric project GID.

---

#### Key Function: `syncStudentGroupFromAsana(group, accessToken?, fallbackLeadName?, options?): Promise<StudentGroup>`
Refreshes one team. With a token it reads the live project from Asana, excludes lecturer advisory notices from all scoring inputs, marks collaborators who have left the project as "Left project" (excluded from scoring) and computes authentic workload shares with the largest-remainder method, totalling exactly $100\%$. Without a token it only regenerates the data of a **simulated** team. A **live** team is never replaced with sample data: without a token the function throws `Paste your Asana token to sync this project.` (abridged excerpt):
```typescript
export async function syncStudentGroupFromAsana(
  group: StudentGroup,
  accessToken?: string,
  fallbackLeadName?: string,
  options?: { lecturerName?: string; lecturerAsanaGid?: string }
): Promise<StudentGroup> {
  const cleanToken = accessToken?.trim();

  // Live data must NEVER be replaced by sample data if the token is missing
  if (group.dataSource === 'live' && !cleanToken) {
    throw new AsanaApiError(401, 'Paste your Asana token to sync this project.');
  }

  const projectId =
    extractAsanaProjectId(group.asanaWorkspace || '') ||
    extractAsanaProjectId(group.id) ||
    extractAsanaProjectId(group.repoUrl);
  if (!projectId) {
    throw new AsanaApiError(400, 'Could not find an Asana project ID in that input');
  }

  let fetched: FetchedAsanaData;
  let isLive = false;

  if (cleanToken) {
    // Live fetch: a failed fetch throws AsanaApiError (no catch that swaps in generated data)
    const { project, tasks } = await fetchLiveAsanaProject(projectId, cleanToken);
    isLive = true;
    const advisoryGids = (group.messages || []).map((m) => m.taskGid).filter(Boolean) as string[];
    fetched = processRealAsanaData(project, tasks, { /* team name, course, lead, advisoryGids, lecturer */ });
  } else {
    // Simulated teams only: explicitly generated data
    fetched = generateStudentProjectFromId(projectId, { /* team name, course, lead */ });
  }

  // Live sync only: members no longer in Asana are kept with status 'Left project' and a 0% share
  // ... build the updated group with buildStudentGroupFromAsana(...) and return it with
  //     dataSource: isLive ? 'live' : 'simulated'
}
```
In the current screens the Sync buttons call this function without a token, so they refresh simulated teams only (see Known Limitations in Section 8).

---

### Module 2: Pedagogical Health Scoring Engine (`src/engine/scoring.ts`)

#### Mathematical Formulation
The project Health Score $H \in [0, 100]$ is computed as a weighted linear combination:

$$H = 0.30 \cdot S_{\text{completion}} + 0.25 \cdot S_{\text{overdue}} + 0.20 \cdot S_{\text{activity}} + 0.15 \cdot S_{\text{equity}} + 0.10 \cdot S_{\text{comm}}$$

Where:
1. **$S_{\text{completion}}$ (Task Completion)**: Percentage of finished tasks:
   $$S_{\text{completion}} = \left( \frac{N_{\text{completed}}}{N_{\text{total}}} \right) \cdot 100$$
2. **$S_{\text{overdue}}$ (Overdue Penalty)**: Base 100 penalized by overdue count and cumulative days overdue:
   $$S_{\text{overdue}} = \max\left(0, 100 - 20 \cdot N_{\text{overdue}} - 2 \cdot \sum D_{\text{overdue}}\right)$$
3. **$S_{\text{activity}}$ (Member Recency)**: Measures active contribution intervals across members.
4. **$S_{\text{equity}}$ (Workload Equity)**: Penalizes disproportionate single-member load ($>50\%$).
5. **$S_{\text{comm}}$ (Communication Score)**: Tracks team messaging velocity and intervention responses.

```typescript
export function computeHealthScore(metrics: ScoringMetrics): number {
  const score =
    metrics.taskCompletionScore * 0.30 +
    metrics.overdueTaskScore * 0.25 +
    metrics.memberActivityScore * 0.20 +
    metrics.workloadEquityScore * 0.15 +
    metrics.communicationScore * 0.10;

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

---

### Module 3: Team Communication & Dispatch (`src/services/asanaService.ts` & `firestoreProjects.ts`)

#### Key Function: `postMessageToAsanaProject(...)`
Posts an advisory notice to the student team's Asana board. With no token, nothing is posted and the result says so (`success: false`, `simulated: true`, "Recorded only. Nothing was posted to Asana."); success is returned only when Asana accepts the task and returns its id (abridged excerpt):
```typescript
export async function postMessageToAsanaProject(
  projectIdOrUrl: string,
  accessToken?: string,
  subject: string = '',
  message: string = '',
  recipientName?: string,
  memberUserGids?: string[]
): Promise<PostMessageResult> {
  const projectId = extractAsanaProjectId(projectIdOrUrl);
  const cleanToken = accessToken?.trim();

  // No token: no fake success and no mock task id
  if (!cleanToken || !projectId) {
    return { success: false, simulated: true, message: 'Recorded only. Nothing was posted to Asana.' };
  }

  // Task created WITHOUT a due date, name prefixed "[ProjectHealth AI] Lecturer advisory:"
  const bodyData: any = {
    data: {
      projects: [projectId],
      name: `[ProjectHealth AI] Lecturer advisory: ${subject}`,
      notes: `${message}\n\n---\nTarget Recipient: ${recipientName || 'Entire Team'}\nDispatched via ProjectHealth AI\nTimestamp: ${new Date().toLocaleString()}`,
    },
  };
  // followers: only real numeric Asana user ids are added, so those students are notified

  // POST /api/asana/tasks, then https://app.asana.com/api/1.0/tasks
  // res.ok and a returned task gid => { success: true, taskGid, message, membersNotified }
  // otherwise => { success: false, message: <Asana error text> }
}
```

---

## 5. Implementation Strategy & Design Patterns

### Key Programming Concepts
1. **Separation of Concerns (SoC)**: Business logic and mathematics (`scoring.ts`) are completely detached from UI components (`GroupDetailsView.tsx`).
2. **Immutability & Pure Functions**: Domain state is updated through immutable copies using object spread syntax, preventing accidental side effects.
3. **Multi-Tenant Scoping Pattern**: All database reads and writes are automatically partitioned by the authenticated user's ID (`lecturerId`), ensuring complete data privacy.
4. **Graceful Degradation Without Hidden Fallbacks**: If Firestore is unreachable, the app falls back to the browser's local copy of the lecturer's data. If Asana rejects a live request (bad token, project not found, rate limit), the app shows a clear error and keeps the last good data: it never silently swaps in sample data. Sample data appears only in the clearly labelled *Simulated* mode.

---

## 6. System Configuration & Deployment

### Firestore Security Configuration (`firestore.rules`)
Cloud Firestore rules enforce that lecturers can only access documents matching their authenticated UID:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function ownsDoc() { return signedIn() && resource.data.lecturerId == request.auth.uid; }
    function createsOwn() { return signedIn() && request.resource.data.lecturerId == request.auth.uid; }
    function lecturerUnchanged() { return request.resource.data.lecturerId == resource.data.lecturerId; }
    function ownsParent(groupId) {
      return signedIn() && get(/databases/$(database)/documents/groups/$(groupId)).data.lecturerId == request.auth.uid;
    }
    match /users/{uid} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }
    match /groups/{groupId} {
      allow read, delete: if ownsDoc();
      allow create: if createsOwn();
      allow update: if ownsDoc() && lecturerUnchanged();
      match /messages/{id} { allow read, write: if ownsParent(groupId); }
      match /history/{id} { allow read, write: if ownsParent(groupId); }
    }
    match /alerts/{alertId} {
      allow read, delete: if ownsDoc();
      allow create: if createsOwn();
      allow update: if ownsDoc() && lecturerUnchanged();
    }
  }
}
```

### Production Build & Deployment Command
To generate the optimized static production build:
```bash
npm run build
```
Output files are generated into the `/dist` directory, ready for deployment to Firebase Hosting, Cloud Run, Vercel, or AWS S3.

---

## 7. Testing & Validation Methodologies

The codebase includes 69 automated tests, written with Vitest, covering the functional and non-functional requirements (FR-1 to NFR-3) and the defects found in review (Review 1 to Review 7). The tests run headless in Node.js with no browser, no Firebase project and no Asana token: calls to Asana are replaced with mocked responses.

### Test Execution Command
```bash
npm install
npm test
```

### Test Results
The tests live in `tests/requirements.test.ts` and are configured in `vitest.config.ts`. Each line below is one group of tests with its number of tests in brackets (`npm test` prints every individual test as well).
```
> react-example@0.0.0 test
> vitest run --reporter=tree

 RUN  v5.0.3 /path/to/project-health-ai

 ✓ tests/requirements.test.ts (69 tests) 84ms
   ✓ FR-1 Authentication and tenant isolation (rules file) (2)
   ✓ FR-2 Asana ingestion and URL parsing (3)
   ✓ FR-3 Multi-factor scoring (weights 30/25/20/15/10) (2)
   ✓ FR-4 Risk classification (70 and 40 thresholds) (3)
   ✓ FR-5 Member sync and workload equity (shares total 100) (2)
   ✓ FR-6 Communication audit and invariance (mocked Asana) (2)
   ✓ NFR-1 Performance and low latency (1)
   ✓ NFR-2 Resilience and edge-case stability (3)
   ✓ NFR-3 Data integrity (simulated sync, no network) (2)
   ✓ Review 1 Asana URL and ID parsing (9)
   ✓ Review 2 Real workload shares and equity calculation (15)
     ✓ lopsided team (8, 1, 1 completed tasks) (3)
     ✓ one-member team (2)
     ✓ no completed tasks, assigned tasks 3 and 1 (3)
     ✓ no completed and no assigned tasks (three students) (3)
     ✓ ties (4)
   ✓ Review 3 Advisory task exclusion from scoring (6)
   ✓ Review 4 No silent fallback to simulated data (4)
   ✓ Review 5 Risk-band boundaries (6)
   ✓ Review 6 One shared overdue formula: max(0, 100 - 20N - 2D) (6)
     ✓ advisory and lecturer tasks are ignored (3)
   ✓ Review 7 Live-data protection (3)

 Test Files  1 passed (1)
      Tests  69 passed (69)
   Start at  21:28:00
   Duration  419ms (transform 60%, tests 30%, import 9%, worker 1%)
```

---

## 8. Engineering Challenges & Implemented Solutions

| Area / Feature | Requirement & Challenge | Implemented Architectural Solution |
| :--- | :--- | :--- |
| **1. Firestore Security Rules** | Strict multi-tenant isolation; prevent unauthorized read/write access to student data. | Deployed owner-only rules enforcing `lecturerId == request.auth.uid` across `/users/{uid}`, `/groups/{groupId}` (including `/messages` and `/history` subcollections, which check the parent group's owner), and `/alerts/{alertId}` (the rules allow alert documents, but the current app keeps alerts in the browser only). |
| **2. Password Recovery** | Insecure OTP codes and exposed static passcodes. | Removed all OTP screens, static codes, and on-screen code displays. Implemented standard email password reset via `sendPasswordResetEmail` with a generic confirmation message and maintained 15-minute lockout on 5 failed attempts. |
| **3. Advisory Message Isolation** | Lecturer intervention messages artificially inflated team communication and overdue metrics. | Created Asana tasks without due dates with prefix `[ProjectHealth AI] Lecturer advisory:`, saved task GIDs on message audit records, and excluded all advisory/lecturer tasks from scoring while freezing communication score changes on sent messages. |
| **4. Authentic Workload Distribution** | Artificial equal-split normalization hid student contribution discrepancies. | Replaced equal-split with raw contribution shares based on completed tasks (fallback to assigned), applying the largest-remainder rounding method to sum to 100%, and computing equity factor from the maximum share fraction. |
| **5. Asana URL & ID Parsing** | Support modern workspace URLs and avoid fallback to static IDs. | Added regex matching for `app.asana.com/1/{workspaceId}/project/{projectId}/...` before legacy forms; removed all hardcoded project ID fallbacks, returning descriptive errors if no ID is found. |
| **6. Truth in Telemetry & No Silent Fallbacks** | Failed Asana API calls silently reverted to simulated data. | Removed silent catch fallback. Failed fetches return structured error messages ("Asana token rejected", "Project not found", rate limit), keep existing group data intact, and display prominent "Simulated" / "Synced from Asana" badges. |
| **7. Interim Token Security** | In-browser tokens risking accidental persistence or leak. | Configured Asana token field as password type with prototype warning notice. Maintained token strictly in ephemeral memory, never saving to Firestore, `localStorage`, logs, or URLs, and clearing on sign-out. |
| **8. Automated Regression Suites** | Ensuring strict compliance across all scoring, parsing, and resilience requirements. | Built a Vitest suite in `tests/requirements.test.ts` (run with `npm test`) covering the 9 original requirement groups plus 7 review groups (69/69 passing). |

### Known Limitations of This Prototype
The Technical Implementation Document lists all 16 limitations that were logged (7 fixed, 2 mitigated, 7 open). The ones to know before running or demonstrating the app:

* **Asana token.** It is typed into the browser and kept in memory only, so use a throwaway token. No Sync button can send it, so a team added with a token cannot be refreshed from a Sync button; add it again with the token instead.
* **Simulated teams.** They are generated from the project ID. Their due dates are fixed when added, so their scores drift down day by day. A token typed together with a sample team or **Pull Data** does not make the app read Asana, although the saved team is then marked live; use **Live Asana REST API** for a real project. The token box keeps its text until you sign out or reload the page, so clear it before adding a demo team.
* **Local cache.** The browser keeps group data, alerts and a plain-text copy of the password typed at sign-up (used to sign in when Firebase cannot be reached). Sign-out does not clear it. This must be removed before real use.
* **Alerts.** They are saved in the browser only, and the in-app alert tick box in Settings is not connected to anything yet.
* **Unused files.** 14 source files are no longer imported by the running app (`components/ActionModals`, `DemoPanel`, `GaugeChart`, `Layout`, `RawAssessmentModal`, `RiskBadge`, `Sparkline`; `data/seedData.ts`; `hooks/useAlerts`, `useAuth`, `useToast`; `pages/LoginPage.tsx`; `services/api.ts`, `services/assessmentRunner.ts`). They can be deleted.

---

## 9. Future Enhancements & Scalability

1. **Learning Management System (LMS) Integration**: Native LTI 1.3 compliance for direct roster imports from Canvas, Blackboard, and Moodle.
2. **Machine Learning Predictive Risk**: Transition from heuristic linear scoring to trained decision trees predicting final submission failure probabilities from Git commit rhythms.
3. **Automated Team Standup Bot**: Integrate bidirectional Slack/Discord bot collecting student standups and feeding sentiment metrics into the communication factor.
4. **Course-Level Aggregates**: Cross-semester cohort analytics comparing student performance across academic years.

---

## 10. Conclusion & Acknowledgments

**ProjectHealth AI** provides university instructors with a comprehensive, objective, and timely early-warning platform for student group supervision. By uniting Asana task telemetry with robust multi-factor scoring algorithms and persistent cloud storage, the system ensures at-risk teams receive the support they need before milestones fail.

### Acknowledgments
* Developed with Google AI Studio.
* UI components styled with Tailwind CSS and Lucide React.
* Telemetry and database services powered by Google Firebase (Auth & Firestore).
