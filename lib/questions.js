// ============================================================
// POWERMATE STAFF REPORT — QUESTION CONFIG
// ============================================================
//
// HOW TO ADD A NEW STAFF MEMBER
// 1. Copy an existing entry from the STAFF array below.
// 2. Set a unique `id` (lowercase, no spaces), `name`, and `role`.
// 3. Edit the `dailyQuestions` and `weeklyQuestions` arrays.
//
// QUESTION TYPES
//   yesno   — Yes/No buttons. Add `followUp:'…'` to require a
//             text reason when the user picks No.
//   number  — Number input. Add `followUp:'…'` to require a
//             text reason when the value is greater than 0.
//   text    — Single-line free text.
//   detail  — Multi-line free text (longer answers).
//   priorities — Always 3 numbered priority inputs. There should
//                be exactly one of these per form, at the end.
//   section — Renders a section divider; uses `section:'Title'`.
//
// All non-section questions need a unique `id`. Mark required
// fields with `required: true`.
// ============================================================

export const STAFF = [
  {
    id: 'courtney',
    name: 'Courtney Sully',
    role: 'Scheduling & Operations',

    dailyQuestions: [
      { section: 'Start of report' },
      {
        id: 'priorities_done',
        label: 'Did you complete all 3 priority items from your last workday?',
        type: 'yesno',
        required: true,
        followUp: 'List each incomplete item and the reason it was not completed.',
      },

      { section: 'Inbox & customer engagement' },
      {
        id: 'sm8_inbox',
        label: 'Has the Servicem8 inbox been checked and all new inquiries converted to jobs?',
        hint: 'Also check the external letterbox and respond to any outstanding inquiries.',
        type: 'yesno',
        required: true,
        followUp: 'List what is outstanding and when it will be actioned.',
      },
      {
        id: 'quotes_presented',
        label: 'How many quotes did you complete and present today?',
        hint: 'Basic solar, electrical, shed, heat pump, hot water. List each: Job # — Customer — Value — Hours. Enter 0 if none.',
        type: 'detail',
        required: true,
      },
      {
        id: 'quotes_converted',
        label: 'How many quotes were converted to accepted work orders today?',
        hint: 'List each: Job # — Customer — Value. Enter 0 if none.',
        type: 'detail',
        required: true,
      },

      { section: 'Scheduling & preparation' },
      {
        id: 'schedule_80',
        label: 'Has more than 80% of all secured work been scheduled?',
        hint: 'Secured = accepted work order received from customer.',
        type: 'yesno',
        required: true,
        followUp: 'List unscheduled jobs and the specific reason each has not been scheduled (e.g. waiting on materials, crew unavailable, customer TBC).',
      },
      {
        id: 'workorders_ready',
        label: 'Have work orders been procured, packed and prepared for at least the next 3 working days?',
        hint: 'Includes: parts ordered and received, work packs complete, materials packed.',
        type: 'yesno',
        required: true,
        followUp: 'List which upcoming jobs are not ready and what is missing or outstanding.',
      },
      {
        id: 'bookings',
        label: 'Have all required sub-contractors and equipment been booked for upcoming jobs?',
        hint: 'Includes sub-contractors, own equipment, and dry hire where applicable.',
        type: 'yesno',
        required: true,
        followUp: 'List what has not been confirmed and the reason.',
      },

      { section: 'Invoicing & job management' },
      {
        id: 'invoicing',
        label: 'Has all invoicing been completed within 5 days of work completion?',
        hint: 'Check all jobs completed more than 5 days ago. Approve from Servicem8 to Xero.',
        type: 'yesno',
        required: true,
        followUp: 'List each uninvoiced job, its completion date, and the reason for delay. No exceptions.',
      },
      {
        id: 'jms_action',
        label: 'Have all Servicem8 action-required tasks been completed this morning and afternoon?',
        type: 'yesno',
        required: true,
        followUp: 'List jobs with outstanding action items.',
      },
      {
        id: 'jms_tech',
        label: 'Have tech reports been completed or followed up in the job diary for every job today?',
        hint: 'Must be in the job diary — verbal confirmation is not sufficient.',
        type: 'yesno',
        required: true,
        followUp: 'List jobs with outstanding tech reports and the last follow-up action taken.',
      },
      {
        id: 'wip_30',
        label: 'How many work orders have been open for more than 30 days?',
        hint: 'Format: Job # — Customer — Days open — Reason — Next action by [date]. Enter "None" if none.',
        type: 'detail',
        required: true,
      },

      { section: 'Wrap-up' },
      {
        id: 'help_needed',
        label: 'What do you need help with, and who do you need it from?',
        hint: 'Be specific. Enter "Nothing — all clear" if no help needed.',
        type: 'detail',
        required: true,
      },
      {
        id: 'next_priorities',
        type: 'priorities',
        required: true,
      },
    ],

    weeklyQuestions: [
      { section: 'Materials & warehouse' },
      {
        id: 'aged_materials',
        label: 'Have all aged materials on the work order shelf been returned to shelves?',
        hint: 'Aged = parts for cancelled, on-hold, or jobs not proceeding within 2 weeks.',
        type: 'yesno',
        required: true,
        followUp: 'Describe what is still on the shelf and when it will be resolved.',
      },
      {
        id: 'warehouse_clean',
        label: 'Is the warehouse clean, tidy and free from materials blocking access to shelving?',
        hint: 'Nothing on the floor, shelves stocked neatly, vehicle restocking inbox checked.',
        type: 'yesno',
        required: true,
      },

      { section: 'Meetings & records' },
      {
        id: 'meeting_prep',
        label: 'Has the next staff meeting been prepared with an agenda?',
        hint: 'Agenda must be circulated at least 24 hours before. Answer Yes if no meeting this week.',
        type: 'yesno',
        required: true,
        followUp: 'State when the agenda will be prepared and sent.',
      },
      {
        id: 'meeting_minutes',
        label: 'Have all minutes from the previous meeting been finalised and circulated to all staff?',
        hint: 'Must be sent within 24 hours of the meeting.',
        type: 'yesno',
        required: true,
        followUp: 'State the meeting date and your completion plan.',
      },
      {
        id: 'insurance_records',
        label: 'Are all insurance and licensing records current?',
        hint: 'Covers: Public Liability, Workers Comp, Vehicle Insurance, Equipment, Contractor Licensing. Flag anything expiring within 60 days.',
        type: 'yesno',
        required: true,
        followUp: 'List which records are expired or expiring and the action being taken.',
      },

      { section: 'Weekly summary' },
      {
        id: 'extra_tasks',
        label: 'What other tasks did you complete this week beyond your core responsibilities?',
        hint: 'Enter "None" if not applicable.',
        type: 'detail',
        required: true,
      },
      {
        id: 'improvements',
        label: 'What business improvement did you work on or identify this week?',
        hint: 'Be specific — "Updated invoice template to reduce errors" is good. "General admin" is not acceptable.',
        type: 'detail',
        required: true,
      },

      { section: 'Wrap-up' },
      {
        id: 'help_needed',
        label: 'What do you need help with, and who do you need it from?',
        hint: 'Enter "Nothing — all clear" if no help needed.',
        type: 'detail',
        required: true,
      },
      {
        id: 'next_priorities',
        type: 'priorities',
        required: true,
      },
    ],
  },

  {
    id: 'paige',
    name: 'Paige Eves',
    role: 'Compliance & Administration',

    dailyQuestions: [
      { section: 'Start of report' },
      {
        id: 'priorities_done',
        label: 'Did you complete all 3 priority items from your last workday?',
        type: 'yesno',
        required: true,
        followUp: 'List each incomplete item and the reason it was not completed.',
      },

      { section: 'Inbox & customer engagement' },
      {
        id: 'sm8_inbox',
        label: 'Has the Servicem8 inbox been checked and all new inquiries converted to jobs?',
        hint: 'Also check the external letterbox and respond to any outstanding inquiries.',
        type: 'yesno',
        required: true,
        followUp: 'List what is outstanding and when it will be actioned.',
      },
      {
        id: 'leads_followed',
        label: 'Were all new solar calculator leads followed up today?',
        hint: 'These arrive via the admin email. Answer Yes if none received today.',
        type: 'yesno',
        required: true,
        followUp: 'List leads not yet contacted and when they will be followed up.',
      },
      {
        id: 'quotes_presented',
        label: 'How many quotes did you complete and present today?',
        hint: 'Basic solar, electrical, shed, heat pump, hot water. List each: Job # — Customer — Value — Hours. Enter 0 if none.',
        type: 'detail',
        required: true,
      },
      {
        id: 'quotes_converted',
        label: 'How many quotes were converted to accepted work orders today?',
        hint: 'List each: Job # — Customer — Value. Enter 0 if none.',
        type: 'detail',
        required: true,
      },

      { section: 'Work order preparation' },
      {
        id: 'checklist_actions',
        label: 'Have checklist actions been created in all new work orders as per the approved quote?',
        hint: 'Every accepted work order must have a task list assigned before it moves to scheduling.',
        type: 'yesno',
        required: true,
        followUp: 'List work orders missing checklist actions and when they will be completed.',
      },
      {
        id: 'tasks_allocated',
        label: 'Have all tasks on active work orders been allocated to the correct person responsible?',
        hint: 'Review all open work orders — every task line must have an owner.',
        type: 'yesno',
        required: true,
        followUp: 'List work orders with unallocated tasks.',
      },

      { section: 'Energex & compliance' },
      {
        id: 'formbay_pending',
        label: 'How many STC / Formbay forms are pending submission after onsite work completion?',
        hint: 'Enter 0 if none pending.',
        type: 'number',
        required: true,
        followUp: 'List job numbers with pending submissions and the reason for the delay.',
      },
      {
        id: 'energex_submitted',
        label: 'Have all Energex / Ergon CONNECTs and EWRs been submitted for current solar works?',
        hint: 'Includes all jobs where onsite work has been completed.',
        type: 'yesno',
        required: true,
        followUp: 'List job numbers not yet submitted and the reason (e.g. waiting on info, portal error, not yet actioned).',
      },

      { section: 'Warranty & owners manuals' },
      {
        id: 'warranty_open',
        label: 'How many warranty claims are currently open?',
        hint: 'Claims older than 21 days must include an escalation note in the follow-up.',
        type: 'number',
        required: true,
        followUp: 'For each open claim list: Job # — Customer — Days open — Last action — Next step.',
      },
      {
        id: 'owners_manuals',
        label: 'Are all solar owners manuals complete within 5 days of job completion?',
        hint: 'Check all jobs completed in the last 5 business days.',
        type: 'yesno',
        required: true,
        followUp: 'List job numbers with outstanding manuals and your completion plan.',
      },

      { section: 'Job management' },
      {
        id: 'jms_action',
        label: 'Have all Servicem8 action-required tasks been completed this morning and afternoon?',
        type: 'yesno',
        required: true,
        followUp: 'List jobs with outstanding action items.',
      },
      {
        id: 'jms_tech',
        label: 'Have tech reports been completed or followed up in the job diary for every job today?',
        type: 'yesno',
        required: true,
        followUp: 'List jobs with outstanding tech reports and the last follow-up action taken.',
      },

      { section: 'Wrap-up' },
      {
        id: 'help_needed',
        label: 'What do you need help with, and who do you need it from?',
        hint: 'Be specific. Enter "Nothing — all clear" if no help needed.',
        type: 'detail',
        required: true,
      },
      {
        id: 'next_priorities',
        type: 'priorities',
        required: true,
      },
    ],

    weeklyQuestions: [
      { section: 'Safety & assets' },
      {
        id: 'assets_documented',
        label: 'Have all new assets been documented in Safety Culture with photos and serial numbers?',
        hint: 'Includes any new tools, equipment, or vehicles received this week. Answer Yes if nothing new received.',
        type: 'yesno',
        required: true,
        followUp: 'List assets not yet documented and your planned completion date.',
      },
      {
        id: 'safety_culture',
        label: 'Are all licence, training, and certification records in Safety Culture current?',
        hint: 'Check for anything expiring within the next 30 days and flag it even if answering Yes.',
        type: 'yesno',
        required: true,
        followUp: 'List the record, who it belongs to, expiry date, and action being taken.',
      },
      {
        id: 'ewp_servicing',
        label: 'Are all EWPs and electrical test equipment up to date with servicing and calibration?',
        type: 'yesno',
        required: true,
        followUp: 'List the asset, what is overdue, and who has been notified.',
      },

      { section: 'Admin & follow-up' },
      {
        id: 'wixtrac',
        label: 'Have WixTrack vehicle history reports been downloaded and saved for the most recent pay cycle?',
        hint: 'Must be completed within 1 day of each pay cycle ending.',
        type: 'yesno',
        required: true,
        followUp: 'Provide the reason and your planned completion date.',
      },
      {
        id: 'post_install',
        label: 'Have all 3-month and 12-month post-installation follow-ups been actioned this week?',
        hint: 'Answer Yes if none due this week.',
        type: 'yesno',
        required: true,
        followUp: 'List the customer, job number, and when follow-up will be completed.',
      },

      { section: 'Materials & warehouse' },
      {
        id: 'warehouse_clean',
        label: 'Is the warehouse clean, tidy and free from materials blocking access to shelving?',
        hint: 'Nothing on the floor, shelves stocked neatly, vehicle restocking inbox checked.',
        type: 'yesno',
        required: true,
      },

      { section: 'Weekly summary' },
      {
        id: 'extra_tasks',
        label: 'What other tasks did you complete this week beyond your core responsibilities?',
        hint: 'Enter "None" if not applicable.',
        type: 'detail',
        required: true,
      },
      {
        id: 'improvements',
        label: 'What business improvement did you work on or identify this week?',
        hint: 'Be specific. Enter "None identified this week" if genuinely none.',
        type: 'detail',
        required: true,
      },

      { section: 'Wrap-up' },
      {
        id: 'help_needed',
        label: 'What do you need help with, and who do you need it from?',
        hint: 'Enter "Nothing — all clear" if no help needed.',
        type: 'detail',
        required: true,
      },
      {
        id: 'next_priorities',
        type: 'priorities',
        required: true,
      },
    ],
  },
];
