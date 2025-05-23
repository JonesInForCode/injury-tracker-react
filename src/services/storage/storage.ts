/**
 * Data storage service for the Employee Injury Case Tracker
 */

import { Employee, FollowUp, CATEGORIES, CategoryKey, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { dataService } from './indexeddb';
import { 
  createEmployee, 
  createFollowUp, 
  getLatestFollowUp, 
  applyFilters,
  FilterOptions 
} from './models';
import { getTodayDate, addDays, calculateDaysDifference } from '@/utils/dates';

interface BackupData {
  version: string;
  date: string;
  settings: Settings;
  employees: Employee[];
}

/**
 * Storage service class that manages data operations
 */
export class StorageService {
  private employees: Employee[] = [];
  private settings: Settings = { ...DEFAULT_SETTINGS };

  /**
   * Load data from storage (IndexedDB with localStorage fallback)
   */
  async loadData(): Promise<boolean> {
    try {
      // Try to load from IndexedDB first
      this.employees = await dataService.getAllEmployees();
      this.settings = await dataService.getSettings();

      console.log('Data loaded successfully from IndexedDB:', this.employees.length, 'employees');
      return true;
    } catch (error) {
      console.error('Error loading data from IndexedDB:', error);

      // Fallback to localStorage
      try {
        console.log('Falling back to localStorage...');
        // Load employees
        const savedEmployees = localStorage.getItem('employeeInjuryData');
        if (savedEmployees) {
          this.employees = JSON.parse(savedEmployees);
        }

        // Load settings
        const savedSettings = localStorage.getItem('employeeInjurySettings');
        if (savedSettings) {
          this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
        }

        console.log('Data loaded successfully from localStorage:', this.employees.length, 'employees');
        return true;
      } catch (localError) {
        console.error('Error loading data from localStorage:', localError);
        throw new Error('Failed to load data from any storage method');
      }
    }
  }

  /**
   * Save data to storage (IndexedDB with localStorage fallback)
   */
  async saveData(): Promise<boolean> {
    try {
      // Save to IndexedDB
      await dataService.saveAllEmployees(this.employees);
      await dataService.saveSettings(this.settings);

      // Also save to localStorage as backup
      localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));
      localStorage.setItem('employeeInjurySettings', JSON.stringify(this.settings));

      console.log('Data saved successfully to IndexedDB and localStorage');
      return true;
    } catch (error) {
      console.error('Error saving data to IndexedDB:', error);

      // Try localStorage only
      try {
        localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));
        localStorage.setItem('employeeInjurySettings', JSON.stringify(this.settings));
        console.log('Data saved to localStorage as fallback');
        return true;
      } catch (localError) {
        console.error('Error saving to localStorage:', localError);
        throw new Error('Failed to save data to any storage method');
      }
    }
  }

  /**
   * Get all employees
   */
  getEmployees(): Employee[] {
    return [...this.employees];
  }

  /**
   * Get current settings
   */
  getSettings(): Settings {
    return { ...this.settings };
  }

  /**
   * Find an employee by ID
   */
  async findEmployeeById(employeeId: string): Promise<Employee | null> {
    try {
      // Try IndexedDB first
      const employee = await dataService.findEmployeeById(employeeId);
      if (employee) {
        return employee;
      }
    } catch (error) {
      console.error('Error finding employee in IndexedDB:', error);
    }

    // Fallback to memory cache
    return this.employees.find(emp => emp.id === employeeId) || null;
  }

  /**
   * Add a new employee
   */
  async addEmployee(employeeData: Parameters<typeof createEmployee>[0]): Promise<string> {
    const newEmployee = createEmployee(employeeData);

    try {
      // Save to IndexedDB
      await dataService.saveEmployee(newEmployee);

      // Update memory cache
      this.employees.push(newEmployee);

      // Save all data (to ensure localStorage backup is updated)
      await this.saveData();

      return newEmployee.id;
    } catch (error) {
      console.error('Error adding employee to IndexedDB:', error);

      // Fallback to memory and localStorage only
      this.employees.push(newEmployee);
      localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));

      return newEmployee.id;
    }
  }

  /**
   * Update an employee
   */
  async updateEmployee(employeeId: string, updatedData: Partial<Employee>): Promise<boolean> {
    // Find employee in memory
    const index = this.employees.findIndex(emp => emp.id === employeeId);
    if (index === -1) return false;

    // Update in memory
    this.employees[index] = { ...this.employees[index], ...updatedData };

    try {
      // Update in IndexedDB
      await dataService.saveEmployee(this.employees[index]);

      // Save all data
      await this.saveData();

      return true;
    } catch (error) {
      console.error('Error updating employee in IndexedDB:', error);

      // Fallback to localStorage only
      localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));

      return true;
    }
  }

  /**
   * Delete an employee
   */
  async deleteEmployee(employeeId: string): Promise<boolean> {
    const initialLength = this.employees.length;

    // Remove from memory cache
    this.employees = this.employees.filter(emp => emp.id !== employeeId);

    if (initialLength === this.employees.length) {
      return false; // No employee was removed
    }

    try {
      // Delete from IndexedDB
      await dataService.deleteEmployee(employeeId);

      // Save all data
      await this.saveData();

      return true;
    } catch (error) {
      console.error('Error deleting employee from IndexedDB:', error);

      // Fallback to localStorage only
      localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));

      return true;
    }
  }

  /**
   * Add a follow-up to an employee
   */
  async addFollowUp(
    employeeId: string,
    followUpData: Parameters<typeof createFollowUp>[0] & {
      additionalFollowUp: 'Yes' | 'No';
      nextFollowUpDate?: string;
    }
  ): Promise<boolean> {
    // Find employee in memory
    const index = this.employees.findIndex(emp => emp.id === employeeId);
    if (index === -1) return false;

    const followUp = createFollowUp(followUpData);

    if (!this.employees[index].followUpHistory) {
      this.employees[index].followUpHistory = [];
    }

    this.employees[index].followUpHistory.push(followUp);

    // Update next follow-up date
    if (followUpData.additionalFollowUp === 'Yes') {
      this.employees[index].additionalFollowUp = 'Yes';
      this.employees[index].followUpDate = followUpData.nextFollowUpDate || getTodayDate();
    } else {
      // Close the case
      this.employees[index].additionalFollowUp = 'No';
      this.employees[index].closeDate = getTodayDate();
    }

    try {
      // Update in IndexedDB
      await dataService.saveEmployee(this.employees[index]);

      // Save all data
      await this.saveData();

      return true;
    } catch (error) {
      console.error('Error adding follow-up in IndexedDB:', error);

      // Fallback to localStorage only
      localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));

      return true;
    }
  }

  /**
   * Change employee category
   */
  async changeEmployeeCategory(
    employeeId: string,
    newCategory: CategoryKey,
    reason: string
  ): Promise<boolean> {
    // Find employee in memory
    const index = this.employees.findIndex(emp => emp.id === employeeId);
    if (index === -1) return false;

    // Check if the category is actually changing
    if (this.employees[index].status === CATEGORIES[newCategory]) {
      return false;
    }

    // Add a follow-up entry for the category change
    if (!this.employees[index].followUpHistory) {
      this.employees[index].followUpHistory = [];
    }

    this.employees[index].followUpHistory.push({
      date: getTodayDate(),
      by: 'System',
      method: 'System',
      response: `Category changed from "${this.employees[index].status}" to "${CATEGORIES[newCategory]}"`,
      notes: `Reason: ${reason}`
    });

    // Update employee's category
    this.employees[index].status = CATEGORIES[newCategory];

    try {
      // Update in IndexedDB
      await dataService.saveEmployee(this.employees[index]);

      // Save all data
      await this.saveData();

      return true;
    } catch (error) {
      console.error('Error changing category in IndexedDB:', error);

      // Fallback to localStorage only
      localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));

      return true;
    }
  }

  /**
   * Close an employee case
   */
  async closeCase(employeeId: string): Promise<boolean> {
    const employee = await this.findEmployeeById(employeeId);
    if (!employee) return false;

    const followUpData = {
      date: getTodayDate(),
      by: 'System',
      method: 'System',
      response: 'Case closed',
      notes: '',
      additionalFollowUp: 'No' as const
    };

    return this.addFollowUp(employeeId, followUpData);
  }

  /**
   * Reopen an employee case
   */
  async reopenCase(employeeId: string): Promise<boolean> {
    // Find employee in memory
    const index = this.employees.findIndex(emp => emp.id === employeeId);
    if (index === -1) return false;

    // Reopen the case
    this.employees[index].additionalFollowUp = 'Yes';

    // Set follow-up date (default to today)
    this.employees[index].followUpDate = getTodayDate();

    // Add follow-up entry for case reopening
    if (!this.employees[index].followUpHistory) {
      this.employees[index].followUpHistory = [];
    }

    this.employees[index].followUpHistory.push({
      date: getTodayDate(),
      by: 'System',
      method: 'System',
      response: 'Case reopened',
      notes: ''
    });

    try {
      // Update in IndexedDB
      await dataService.saveEmployee(this.employees[index]);

      // Save all data
      await this.saveData();

      return true;
    } catch (error) {
      console.error('Error reopening case in IndexedDB:', error);

      // Fallback to localStorage only
      localStorage.setItem('employeeInjuryData', JSON.stringify(this.employees));

      return true;
    }
  }

  /**
   * Save application settings
   */
  async saveSettings(newSettings: Partial<Settings>): Promise<boolean> {
    this.settings = { ...this.settings, ...newSettings };

    try {
      // Save to IndexedDB
      await dataService.saveSettings(this.settings);

      // Save all data
      await this.saveData();

      return true;
    } catch (error) {
      console.error('Error saving settings to IndexedDB:', error);

      // Fallback to localStorage only
      localStorage.setItem('employeeInjurySettings', JSON.stringify(this.settings));

      return true;
    }
  }

  /**
   * Create backup of all data
   */
  async createBackup(): Promise<Blob> {
    try {
      // Create backup using data service
      const backup = await dataService.createBackup();

      // Convert to JSON
      const backupJSON = JSON.stringify(backup, null, 2);

      // Create Blob
      return new Blob([backupJSON], { type: 'application/json' });
    } catch (error) {
      console.error('Error creating backup from IndexedDB:', error);

      // Fallback to in-memory data
      const backup: BackupData = {
        version: '1.0',
        date: new Date().toISOString(),
        settings: this.settings,
        employees: this.employees
      };

      const backupJSON = JSON.stringify(backup, null, 2);
      return new Blob([backupJSON], { type: 'application/json' });
    }
  }

  /**
   * Restore data from backup
   */
  async restoreFromBackup(backup: BackupData): Promise<boolean> {
    try {
      // Validate backup format
      if (!backup.employees || !Array.isArray(backup.employees)) {
        throw new Error('Invalid backup file format.');
      }

      // Restore with data service
      await dataService.restoreFromBackup(backup);

      // Update memory cache
      this.employees = backup.employees;

      // Update settings if available
      if (backup.settings) {
        this.settings