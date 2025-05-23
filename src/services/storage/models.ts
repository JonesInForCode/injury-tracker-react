/**
 * Data models for the Employee Injury Case Tracker
 */

import { Employee, FollowUp, CATEGORIES, CategoryKey } from '@/types/employee';

// Re-export types for backward compatibility
export { CATEGORIES } from '@/types/employee';

export const FOLLOW_UP_METHODS = ['In-person', 'Phone', 'Email', 'Other'] as const;
export type FollowUpMethod = typeof FOLLOW_UP_METHODS[number];

/**
 * Create a new employee object
 */
export function createEmployee(data: {
  id?: string;
  name: string;
  employeeId: string;
  caseNumber?: string;
  status?: string;
  category?: CategoryKey;
  shift?: string;
  incidentDate: string;
  incidentDescription?: string;
  followUpDate: string;
  followUpBy: string;
  followUpMethod: string;
  followUpResponse: string;
  followUpNotes?: string;
  followUpHistory?: FollowUp[];
}): Employee {
  const initialFollowUp: FollowUp = {
    date: data.followUpDate,
    by: data.followUpBy,
    method: data.followUpMethod,
    response: data.followUpResponse,
    notes: data.followUpNotes || ''
  };

  return {
    id: data.id || Date.now().toString(),
    name: data.name,
    employeeId: data.employeeId,
    caseNumber: data.caseNumber,
    status: data.status || (data.category ? CATEGORIES[data.category] : CATEGORIES['first-aid']),
    shift: data.shift,
    incidentDate: data.incidentDate,
    incidentDescription: data.incidentDescription,
    followUpDate: data.followUpDate,
    additionalFollowUp: 'Yes',
    followUpHistory: data.followUpHistory || [initialFollowUp]
  };
}

/**
 * Create a new follow-up object
 */
export function createFollowUp(data: {
  date: string;
  by: string;
  method: string;
  response: string;
  notes?: string;
}): FollowUp {
  return {
    date: data.date,
    by: data.by,
    method: data.method,
    response: data.response,
    notes: data.notes || ''
  };
}

/**
 * Get the latest follow-up for an employee
 */
export function getLatestFollowUp(employee: Employee): FollowUp {
  return employee.followUpHistory && employee.followUpHistory.length > 0
    ? employee.followUpHistory[employee.followUpHistory.length - 1]
    : {
        date: employee.followUpDate,
        response: '',
        method: '',
        by: ''
      };
}

/**
 * Filter options for employees
 */
export interface FilterOptions {
  searchTerm?: string;
  statusFilter?: 'all' | 'current' | 'closed';
  shiftFilter?: 'all' | string;
  dateFilter?: {
    from: string | null;
    to: string | null;
  } | null;
}

/**
 * Filter employees based on search term and status
 */
export function filterEmployees(
  employees: Employee[],
  searchTerm = '',
  statusFilter: 'all' | 'current' | 'closed' = 'all'
): Employee[] {
  return employees.filter(employee => {
    // Search term matching
    const matchesSearch = !searchTerm
      ? true
      : employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (employee.caseNumber && employee.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status filtering
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'current' && employee.additionalFollowUp === 'Yes') ||
      (statusFilter === 'closed' && employee.additionalFollowUp === 'No');

    return matchesSearch && matchesStatus;
  });
}

/**
 * Apply multiple filters to a list of employees
 */
export function applyFilters(
  employeeList: Employee[],
  options: FilterOptions
): Employee[] {
  const { searchTerm = '', statusFilter = 'all', shiftFilter = 'all', dateFilter = null } = options;

  return employeeList.filter(employee => {
    // Search term filtering
    const matchesSearch = !searchTerm
      ? true
      : employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (employee.caseNumber && employee.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status filtering
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'current' && employee.additionalFollowUp === 'Yes') ||
      (statusFilter === 'closed' && employee.additionalFollowUp === 'No');

    // Shift filtering
    const matchesShift = shiftFilter === 'all' || employee.shift === shiftFilter;

    // Date filtering
    let matchesDate = true;
    if (dateFilter) {
      const incidentDate = new Date(employee.incidentDate);

      if (dateFilter.from) {
        const fromDate = new Date(dateFilter.from);
        if (incidentDate < fromDate) {
          matchesDate = false;
        }
      }

      if (dateFilter.to && matchesDate) {
        const toDate = new Date(dateFilter.to);
        toDate.setHours(23, 59, 59); // Set to end of day
        if (incidentDate > toDate) {
          matchesDate = false;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesShift && matchesDate;
  });
}