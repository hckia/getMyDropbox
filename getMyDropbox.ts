import { Dropbox, files } from 'dropbox';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

declare const process: {
    env: {
      DROP_BOX_ACCESS_TOKEN: string;
    }
  }

interface MyDropboxFileMetadata extends files.FileMetadata {}

class GetMyDropboxDownloader {
    private dbx: Dropbox;
    private rootDir: string;

    constructor(accessToken: string, rootDir: string) {
        this.dbx = new Dropbox({ accessToken });
        this.rootDir = rootDir;
    }

    private async getMyDropboxFile(file: MyDropboxFileMetadata) {
        try {
            const result = await this.dbx.filesGetTemporaryLink({ path: file.path_lower as string });

            const url = result.result.link;

            const localPath = path.join(this.rootDir, file.path_display as string);
            fs.mkdirSync(path.dirname(localPath), { recursive: true });

            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(localPath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

        } catch (error) {
            console.error(`Failed to download file: ${file.path_lower}. Reason: ${error}`);
        }
    }

    private async getMyDropboxDirectory(directory: string) {
        try {
            const response = await this.dbx.filesListFolder({ path: directory });

            for (const entry of response.result.entries) {
                if (entry['.tag'] === 'file') {
                    await this.getMyDropboxFile(entry as MyDropboxFileMetadata);
                } else if (entry['.tag'] === 'folder') {
                    await this.getMyDropboxDirectory(entry.path_lower as string);
                }
            }
        } catch (error) {
            console.error(`Failed to download directory: ${directory}. Reason: ${error}`);
        }
    }

    public async getAllOfMyDropbox() {
        await this.getMyDropboxDirectory('');
    }
}

const downloader = new GetMyDropboxDownloader(process.env.DROP_BOX_ACCESS_TOKEN, './myDropbox');
downloader.getAllOfMyDropbox();
