/**
 * IndexedDB data service for the Employee Injury Case Tracker
 */

import { Employee, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface FileData {
  id: string;
  data: any;
  timestamp: number;
}

interface BackupData {
  version: string;
  date: string;
  settings: Settings;
  employees: Employee[];
}

/**
 * IndexedDB data service class that handles all database operations
 */
export class EmployeeDataService {
  private dbName = 'employeeInjuryTracker';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private initialized: Promise<boolean>;

  constructor() {
    this.initialized = this.initDatabase();
  }

  /**
   * Initialize the database
   */
  private async initDatabase(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Error opening database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create employees store
        if (!db.objectStoreNames.contains('employees')) {
          const employeeStore = db.createObjectStore('employees', { keyPath: 'id' });
          // Create indexes for frequently queried fields
          employeeStore.createIndex('status', 'status', { unique: false });
          employeeStore.createIndex('additionalFollowUp', 'additionalFollowUp', { unique: false });
          employeeStore.createIndex('followUpDate', 'followUpDate', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        // Create files store (for future file storage)
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Ensure database is ready before operations
   */
  private async ensureDbReady(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialized;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Get all employees
   */
  async getAllEmployees(): Promise<Employee[]> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('employees', 'readonly');
      const store = transaction.objectStore('employees');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save all employees (used for bulk updates)
   */
  async saveAllEmployees(employees: Employee[]): Promise<boolean> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('employees', 'readwrite');
      const store = transaction.objectStore('employees');

      // Clear existing data
      store.clear();

      // Add each employee
      let count = 0;
      employees.forEach(employee => {
        const request = store.add(employee);
        request.onsuccess = () => {
          count++;
          if (count === employees.length) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });

      // Handle empty array case
      if (employees.length === 0) {
        resolve(true);
      }

      transaction.oncomplete = () => {
        console.log('All employees saved successfully');
      };

      transaction.onerror = () => {
        console.error('Error saving employees:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Find an employee by ID
   */
  async findEmployeeById(employeeId: string): Promise<Employee | null> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('employees', 'readonly');
      const store = transaction.objectStore('employees');
      const request = store.get(employeeId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add or update a single employee
   */
  async saveEmployee(employee: Employee): Promise<Employee> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('employees', 'readwrite');
      const store = transaction.objectStore('employees');
      const request = store.put(employee); // put will add or update

      request.onsuccess = () => resolve(employee);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete an employee
   */
  async deleteEmployee(employeeId: string): Promise<boolean> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('employees', 'readwrite');
      const store = transaction.objectStore('employees');
      const request = store.delete(employeeId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get employees by status (category)
   */
  async getEmployeesByStatus(status: string): Promise<Employee[]> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('employees', 'readonly');
      const store = transaction.objectStore('employees');
      const index = store.index('status');
      const request = index.getAll(status);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get employees with additional follow-up needed
   */
  async getActiveEmployees(): Promise<Employee[]> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('employees', 'readonly');
      const store = transaction.objectStore('employees');
      const index = store.index('additionalFollowUp');
      const request = index.getAll('Yes');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get application settings
   */
  async getSettings(): Promise<Settings> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('app-settings');

      request.onsuccess = () => {
        // Return default settings if none found
        const result = request.result;
        resolve(result ? result.value : { ...DEFAULT_SETTINGS });
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save application settings
   */
  async saveSettings(settings: Settings): Promise<Settings> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({
        id: 'app-settings',
        value: settings
      });

      request.onsuccess = () => resolve(settings);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Create a backup of all data
   */
  async createBackup(): Promise<BackupData> {
    const employees = await this.getAllEmployees();
    const settings = await this.getSettings();

    return {
      version: '1.0',
      date: new Date().toISOString(),
      settings: settings,
      employees: employees
    };
  }

  /**
   * Restore data from a backup
   */
  async restoreFromBackup(backup: BackupData): Promise<boolean> {
    if (!backup.employees || !Array.isArray(backup.employees)) {
      throw new Error('Invalid backup file format.');
    }

    await this.saveAllEmployees(backup.employees);

    if (backup.settings) {
      await this.saveSettings(backup.settings);
    }

    return true;
  }

  /**
   * Save a file to storage
   */
  async saveFile(filename: string, data: any): Promise<boolean> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const fileData: FileData = {
        id: filename,
        data: data,
        timestamp: new Date().getTime()
      };
      const request = store.put(fileData);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Read a file from storage
   */
  async readFile(filename: string): Promise<any | null> {
    const db = await this.ensureDbReady();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(filename);

      request.onsuccess = () => {
        const result = request.result as FileData | undefined;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a file exists
   */
  async fileExists(filename: string): Promise<boolean> {
    const data = await this.readFile(filename);
    return data !== null;
  }
}

// Create and export a single instance
export const dataService = new EmployeeDataService();