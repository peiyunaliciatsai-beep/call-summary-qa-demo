# SoundSenseAI — Call summary review

A browser-based QA workspace for the 20 supplied fictional collections calls. Reviewers compare generated summaries with transcripts, record evidence-backed findings and decide whether corrections are needed.

## Run

Run `python3 -m http.server 8000` in this directory, then open http://localhost:8000. There are no dependencies, API keys or build step. Serve through HTTP rather than opening index.html directly.

## Review workflow

1. Select a call. Highlight summary text to open a finding.
2. Choose an issue and certainty, add a note and select supporting transcript turn IDs.
3. Add the finding. Saved findings can be edited or removed. Multiple highlighted drafts are retained separately.
4. Choose Acceptable, Needs correction or Uncertain, then Finish review. The next unfinished call opens automatically. Finished reviews must be reopened before editing.
5. Export report downloads readable HTML, including findings, evidence, corrections, unfinished drafts and a completion count.

For an omission, highlight the relevant context in the summary and explain the missing information in the note, citing the transcript turns that establish it. Rules contains the workflow guide and the full supplied reference documents.

## Decision validation

- Acceptable requires no unresolved findings.
- Needs correction requires at least one definite finding with transcript evidence.
- Uncertain requires a finding or a review note explaining the uncertainty.
- Unfinished findings must be saved or discarded before finishing a review.

## Assumptions and scope

- The supplied transcript is the source of truth. No external account checks are performed.
- Reviewers make decisions; there are no automated verdicts, generated corrections or hard-coded case answers.
- Only discussed information required by the rules counts as an omission; acceptable summarisation is not an error.
- The supplied DPA exception and retention of named advice bodies take precedence over the general omission and redaction rules.
- Progress saves in localStorage, per browser profile and site origin. It is not shared across devices; clearing browser data removes it. A fresh browser profile starts with no reviews. Local preview progress does not transfer to the deployed site.
- Authentication, team collaboration and server-side audit history are outside the 90-minute scope. The dataset is fictional.

## Verification

`python3 work/check.py` runs 30 logic checks using macOS JavaScriptCore with lightweight document/selection stubs. These cover ordering, finding validation, quote capture, multiple drafts, edits, reopening, persistence, navigation, report content and escaping. They do not replace real browser testing.

Browser smoke test: create a finding on CALL-002 (£150 in the summary versus £100 confirmed at T14–T16), edit it, finish the review, reload, reopen it, then export and read the report. Accept CALL-005 with no findings. Check an uncertain decision, unfinished-call navigation, search, filters, the Rules dialog and a narrow window.

## Netlify deployment

Import the GitHub repository into Netlify, leave the build command empty, and use `.` as the publish directory. netlify.toml supplies the publish setting. No environment variables are required. Alternatively upload the application files with the data directory for a manual deployment.

## Submission checklist

Record the live application URL, GitHub repository URL, final commit hash and screen-recording link. Repeat the browser smoke test on the live URL before submitting.
