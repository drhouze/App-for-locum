// backend/src/config/drive.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class DriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.initialize();
  }

  initialize() {
    try {
      const credentials = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../service-account.json'), 'utf8')
      );
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      
      this.drive = google.drive({ version: 'v3', auth: this.auth });
    } catch (error) {
      console.error('Failed to initialize Google Drive:', error);
    }
  }

  async ensureFolderExists(folderName, parentId = this.rootFolderId) {
    try {
      // Check if folder exists
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
      });

      if (response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create folder
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };
      const file = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      });
      return file.data.id;
    } catch (error) {
      console.error('Error ensuring folder exists:', error);
      throw error;
    }
  }

  async readJsonFile(fileId) {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      
      return new Promise((resolve, reject) => {
        let data = '';
        response.data
          .on('data', chunk => data += chunk)
          .on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              resolve([]);
            }
          })
          .on('error', reject);
      });
    } catch (error) {
      if (error.code === 404) {
        return [];
      }
      throw error;
    }
  }

  async writeJsonFile(fileId, data, fileName) {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonData, 'utf-8');

      // Check if file exists
      try {
        await this.drive.files.get({ fileId });
        // Update existing file
        const media = {
          mimeType: 'application/json',
          body: buffer,
        };
        await this.drive.files.update({
          fileId,
          media,
        });
        return fileId;
      } catch (error) {
        if (error.code === 404) {
          // Create new file
          const fileMetadata = {
            name: fileName || 'data.json',
            mimeType: 'application/json',
          };
          const media = {
            mimeType: 'application/json',
            body: buffer,
          };
          const file = await this.drive.files.create({
            resource: fileMetadata,
            media,
            fields: 'id',
          });
          return file.data.id;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error writing JSON file:', error);
      throw error;
    }
  }

  async deleteFile(fileId) {
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async listFiles(folderId) {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
      });
      return response.data.files;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  async exportCsv(fileId) {
    try {
      const response = await this.drive.files.export(
        { fileId, mimeType: 'text/csv' },
        { responseType: 'stream' }
      );
      return response.data;
    } catch (error) {
      console.error('Error exporting CSV:', error);
      throw error;
    }
  }
}

module.exports = new DriveService();
