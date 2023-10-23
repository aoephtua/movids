// Copyright (c) 2023, Thorsten A. Weintz. All rights reserved.
// Licensed under the MIT license. See LICENSE in the project root for license information.

import fs from 'fs';
import chalk from 'chalk';
import axios from 'axios';
import moment from 'moment';
import ipcamsd from 'ipcamsd';

/**
 * Writes a message to the console.
 */
const log = console.log;

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
 * Adds custom prefix to string value.
 * 
 * @param {string} value String value to add custom prefix.
 * @param {string} prefix Prefix value to add to string.
 * @param {number} length Length of prefix value.
 * @returns String with prefix and value.
 */
function setPrefix(value, prefix, length) {
    for (let i = 0; i < (length || 1); i++) {
        value = `${prefix}${value}`;
    }

    return value;
}

/**
 * Gets date instance of Moment.js by command line parameters.
 * 
 * @param {date} date Date value of command line.
 * @returns Value of Moment.js or undefined.
 */
function getDate(date) {
    if (date) {
        switch (date.toLowerCase()) {
            case 'today':
                return moment();
            case 'yesterday':
                return moment().subtract(1, 'days');
            default:
                if (date.length === 8) {
                    let result = moment(date);

                    if (result.isValid()) {
                        return result;
                    }
                }
        }
    }
}

/**
 * Sets time segments to date instance of Moment.js.
 * 
 * @param {date} date Date to attach time parts.
 * @param {string} timeStr String with time to set.
 */
function setTime(date, timeStr) {
    if (timeStr && timeStr.length >= 1) {
        const time = moment(timeStr, config.format.time);

        date.set({
            hour: time.get('hour'),
            minute: time.get('minute'),
            second: 0
        });
    }
}

/**
 * Gets times in milliseconds by start and end date command line parameters.
 * 
 * @returns Object with start and end dates in milliseconds
 */
function getTimes() {
    let options = config.options;

    let startDate = getDate(options.startDate);
    let endDate = getDate(options.endDate);

    setTime(startDate, options.startTime);
    setTime(endDate, options.endTime);

    return { start: startDate.valueOf(), end: endDate.valueOf() };
}

/**
 * Gets URL to fetch motions by sending HTTP request.
 * 
 * @param {number} startTime Start time in milliseconds.
 * @param {number} endTime End time in milliseconds.
 * @param {object} restApi Object with API configuration values.
 * @param {object} motions Object with motions configuration values.
 * @returns 
 */
function getMotionsUrl(startTime, endTime, restApi, motions) {
    let { keys: { date }, queryParams, limit } = motions;

    let params = new URLSearchParams([
        ...Object.entries(queryParams || {}),
        [date, `$gte;${startTime}`],
        [date, `$lte;${endTime}`],
        ['limit', limit]
    ]);

    return `${restApi.baseUrl}/${motions.path}?${params.toString()}`;
}

/**
 * Fetches motions by sending HTTP request.
 * 
 * @param {number} startTime Start time in milliseconds.
 * @param {number} endTime End time in milliseconds.
 * @returns Array with motions and count.
 */
async function getMotions(startTime, endTime) {
    let restApi = config.restApi;
    let motions = restApi.endpoints.motions;

    let url = getMotionsUrl(startTime, endTime, restApi, motions);
    let response = await axios.get(url);

    return { 
        count: motions.count ? response.data[motions.count] : null,
        data: response.data[motions.entries]
    };
}

/**
 * Creates directory by name.
 * 
 * @param {string} name String with target name.
 * @returns String with directory name.
 */
function createDirectory(name) {
    let directoryName = `./${name}`;

    if (!fs.existsSync(directoryName)) {
        fs.mkdirSync(directoryName);

        return directoryName;
    }
}

/**
 * Prepares camera values for ipcamsd.
 * 
 * @param {Array} cameras Array with camera entries.
 * @param {string} key String with key of camera property.
 * @param {string} defaultValue String with default value.
 * @returns Array with firmwares for ipcamsd.
 */
function getCameraValues(cameras, key, defaultValue) {
    return cameras
        .map(camera => camera[key] || defaultValue);
}

/**
 * Prepares authentication object for ipcamsd.
 * 
 * @param {Array} cameras Array with camera entries.
 * @returns Object with authentication properties for ipcamsd.
 */
function getAuthenticationObject(cameras) {
    const auth = {};

    for (const camera of cameras) {
        for (const key of ['host', 'username', 'password', 'ssl']) {
            const target = `${key}s`;
            const value = camera[key];

            if (!auth[target]) auth[target] = [];

            if (value) {
                auth[target].push(value);
            }
        }
    }

    return auth;
}

/**
 * Executes command to fetch records with public interface of ipcamsd.
 * 
 * @param {object} config Object with ipcamsd configuration values.
 * @param {object} dateTime Object with options for ipcamsd.
 */
async function execFetchCommand(config, options) {
    const instance = new ipcamsd();

    const { cameras } = config;
    const firmwares = getCameraValues(cameras, 'firmware', 'hi3510');
    const auth = getAuthenticationObject(cameras);

    await instance.process('fetch', firmwares, auth, options);
}

/**
 * Gets object with motion dates by endpoint keys.
 * 
 * @param {*} motion Object with motion values.
 * @returns Object with date values of motion.
 */
function getMotionDates(motion) {
    const { keys: { date, endDate } } = config.restApi.endpoints.motions;

    return {
        start: motion[date],
        end: motion[endDate]
    };
}

/**
 * Downloads, transfers and converts records by detected motions
 * 
 * @param {object} motion Object with motion entry.
 * @param {number} idx Index of motion entry.
 */
async function downloadRecords(motion, idx) {
    const ipcamsd = config.ipcamsd;
    const dates = getMotionDates(motion);

    let startDate = moment(dates.start);
    let endDate = dates.end ? moment(dates.end) :
        moment(dates.start).add(ipcamsd.minutesIfEndDateIsNull, 'minutes');

    let name = `${startDate.format('YYYYMMDD_HHmmss')}_${endDate.format('HHmmss')}`;

    log('');
    log(chalk.cyanBright(`${('0' + (idx + 1)).slice(-2)}. ${name}`));

    let directoryName = createDirectory(name);

    if (directoryName) {
        const format = config.format;

        const options = {
            targetDirectory: directoryName,
            startDate: startDate.format(format.date),
            endDate: endDate.format(format.date),
            startTime: startDate.format(format.time),
            endTime: endDate.format(format.time)
        };

        await execFetchCommand(ipcamsd, options);
    } else {
        log(setPrefix('No actions executed. Directory already exists.', ' ', 4));
    }
}

/**
 * Gets motions of API and fetches records with public interface of ipcamsd.
 */
async function fetchRecords() {
    let times = getTimes();
    let motions = await getMotions(times.start, times.end);
    let data = motions.data;

    if (data && Array.isArray(data)) {
        if (config.restApi.endpoints.motions.reverse) {
            data = data.reverse();
        }

        if (motions.count !== null) {
            log(chalk.magentaBright(`${motions.count} motions found.`));   
        }

        for (let i = 0; i < data.length; i++) {
            await downloadRecords(data[i], i);
        }
    }
}

/**
 * Processes parameters and executes main command.
 * 
 * @param {object} options Object with options of command line interface.
 */
export async function process(options) {
    config.options = options;

    await fetchRecords();
}
