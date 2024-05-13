// Copyright (c) 2024, Thorsten A. Weintz. All rights reserved.
// Licensed under the MIT license. See LICENSE in the project root for license information.

/**
 * Object with default configuration parameters.
 */
const config = {
    restApi: {
        baseUrl: 'http://192.168.178.96:8000',
        endpoints: {
            motions: {
                path: 'api/motions',
                count: 'count',
                entries: 'data',
                reverse: true,
                utc: true,
                keys: {
                    date: 'date',
                    endDate: 'endDate'
                },
                snapshots: {
                    key: 'snapshots',
                    id: '_id',
                    name: 'name',
                    getPath: id => `media/motion/snapshot/${id}`,
                    ext: 'jpg'
                },
                queryParams: {
                    device: '63f47d4503961d23f1ea98f2'
                },
                limit: 0
            }
        }
    },
    ipcamsd: {
        cameras: [{
            host: '192.168.178.30',
            username: 'admin',
            password: 'admin'
        }, {
            host: '192.168.178.31',
            username: 'admin',
            password: 'admin'
        }],
        minutesIfEndDateIsNull: 3
    },
    format: {
        date: 'YYYYMMDD',
        time: 'HHmmss'
    }
};

/**
 * Exports config as default object.
 */
export default config;
