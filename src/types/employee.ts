export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  caseNumber?: string;
  status: string;
  shift?: string;
  incidentDate: string;
  incidentDescription?: string;
  followUpDate: string;
  additionalFollowUp: 'Yes' | 'No';
  followUpHistory: FollowUp[];
  closeDate?: string;
}

export interface FollowUp {
  date: string;
  by: string;
  method: string;
  response: string;
  notes?: string;
}

export const CATEGORIES = {
  'first-aid': 'First Aid Follow-Up',
  'modified-duty': 'Modified Duty',
  'lost-time': 'Lost Time Incidents'
} as const;

export type CategoryKey = keyof typeof CATEGORIES;