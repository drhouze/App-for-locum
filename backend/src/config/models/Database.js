// backend/src/models/Database.js
const driveService = require('../config/drive');

class Database {
  constructor() {
    this.collections = {};
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create root folders for each collection
      const collections = ['users', 'clinics', 'locumSlots', 'auditLogs'];
      
      for (const collection of collections) {
        const folderId = await driveService.ensureFolderExists(collection);
        this.collections[collection] = {
          folderId,
          data: await this.loadCollection(collection),
        };
      }
      
      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async loadCollection(name) {
    try {
      const files = await driveService.listFiles(this.collections[name]?.folderId);
      const data = {};
      
      for (const file of files) {
        if (file.mimeType === 'application/json') {
          const content = await driveService.readJsonFile(file.id);
          // Use filename without extension as key
          const key = file.name.replace('.json', '');
          data[key] = content;
        }
      }
      
      return data;
    } catch (error) {
      console.error(`Error loading collection ${name}:`, error);
      return {};
    }
  }

  async saveCollection(name) {
    try {
      const collection = this.collections[name];
      if (!collection) throw new Error(`Collection ${name} not found`);

      for (const [key, value] of Object.entries(collection.data)) {
        const fileName = `${key}.json`;
        const fileId = await this.getFileId(name, fileName);
        await driveService.writeJsonFile(fileId, value, fileName);
      }
      
      return true;
    } catch (error) {
      console.error(`Error saving collection ${name}:`, error);
      throw error;
    }
  }

  async getFileId(collectionName, fileName) {
    const collection = this.collections[collectionName];
    if (!collection) return null;

    const files = await driveService.listFiles(collection.folderId);
    const file = files.find(f => f.name === fileName);
    return file ? file.id : null;
  }

  async getCollection(name) {
    if (!this.initialized) await this.initialize();
    return this.collections[name]?.data || {};
  }

  async getDocument(collectionName, id) {
    const collection = await this.getCollection(collectionName);
    return collection[id] || null;
  }

  async createDocument(collectionName, id, data) {
    const collection = await this.getCollection(collectionName);
    collection[id] = { ...data, _id: id, createdAt: new Date().toISOString() };
    await this.saveCollection(collectionName);
    return collection[id];
  }

  async updateDocument(collectionName, id, data) {
    const collection = await this.getCollection(collectionName);
    if (!collection[id]) throw new Error('Document not found');
    collection[id] = { ...collection[id], ...data, updatedAt: new Date().toISOString() };
    await this.saveCollection(collectionName);
    return collection[id];
  }

  async deleteDocument(collectionName, id) {
    const collection = await this.getCollection(collectionName);
    if (!collection[id]) throw new Error('Document not found');
    delete collection[id];
    await this.saveCollection(collectionName);
    return true;
  }

  async query(collectionName, filter) {
    const collection = await this.getCollection(collectionName);
    const results = [];
    
    for (const [id, data] of Object.entries(collection)) {
      let match = true;
      for (const [key, value] of Object.entries(filter)) {
        if (data[key] !== value) {
          match = false;
          break;
        }
      }
      if (match) {
        results.push({ ...data, _id: id });
      }
    }
    
    return results;
  }

  async getAll(collectionName) {
    const collection = await this.getCollection(collectionName);
    return Object.entries(collection).map(([id, data]) => ({ ...data, _id: id }));
  }
}

module.exports = new Database();
