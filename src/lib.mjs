// Copyright (c) 2023, Thorsten A. Weintz. All rights reserved.
// Licensed under the MIT license. See LICENSE in the project root for license information.

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import axios from 'axios';
import moment from 'moment';
import Ipcamsd from 'ipcamsd';
import config from './config.mjs';

/**
 * Writes a message to the console.
 */
const log = console.log;

/**
 * Destructed values of configuration object.
 */
const { restApi: { baseUrl, endpoints }, ipcamsd, format } = config;

/**
 * Destructed values of endpoints.
 */
const { motions } = endpoints;

/**
 * Pads value with leading zeros on the left by length.
 * 
 * @param {string|number} value String with value.
 * @param {number} len Total length of entries for padding.
 * @returns Returns string value with leading zeros.
 */
function padWithZeros(value, len) {
    const cnt = (len + '').length;
    
    return (new Array(cnt).join('0') + value).slice(-cnt);
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
        const time = moment(timeStr, format.time);

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
 * @returns String with full URL of motions endpoint.
 */
function getMotionsUrl(startTime, endTime) {
    let { keys: { date }, queryParams, limit } = motions;

    let params = new URLSearchParams([
        ...Object.entries(queryParams || {}),
        [date, `$gte;${startTime}`],
        [date, `$lte;${endTime}`],
        ['limit', limit]
    ]);

    return `${baseUrl}/${motions.path}?${params.toString()}`;
}

/**
 * Fetches motions by sending HTTP request.
 * 
 * @param {number} startTime Start time in milliseconds.
 * @param {number} endTime End time in milliseconds.
 * @returns Array with motions and count.
 */
async function getMotions(startTime, endTime) {
    let url = getMotionsUrl(startTime, endTime);
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
 * @param {object} dateTime Object with options for ipcamsd.
 */
async function execFetchCommand(options) {
    const { cameras } = ipcamsd;
    const firmwares = getCameraValues(cameras, 'firmware', 'hi3510');
    const auth = getAuthenticationObject(cameras);

    await new Ipcamsd().process('fetch', firmwares, auth, options);
}

/**
 * Gets object with motion dates by endpoint keys.
 * 
 * @param {object} motion Object with motion entry.
 * @returns Object with date values of motion.
 */
function getMotionDates(motion) {
    const { keys: { date, endDate } } = motions;

    return {
        start: motion[date],
        end: motion[endDate]
    };
}

/**
 * Downloads captured snapshots of detected motion.
 * 
 * @param {string} directoryName String with name of directory.
 * @param {object} motion Object with motion entry.
 */
async function fetchSnapshots(directoryName, motion) {
    const snapshots = motions.snapshots;

    if (snapshots) {
        const { [snapshots.key]: entries } = motion;
        const len = entries.length;
        
        log(chalk.green.bold('Snapshots'));

        for (let i = 0; i < len; i++) {
            const { [snapshots.id]: id, [snapshots.name]: name } = entries[i];
            const fileName = name || padWithZeros(i + 1, len);
            const fileNameWithExt = `${fileName}.${snapshots.ext}`;
            const fullName = path.join(directoryName, fileNameWithExt);
            const url = `${baseUrl}/${snapshots.getPath(id)}`;

            try {
                const { data } = await axios.get(url, { responseType: 'arraybuffer' });

                fs.writeFileSync(fullName, data);
    
                log(`Downloaded file ${fileNameWithExt}`);
            } catch {
                log(`Error while fetching file ${fileNameWithExt}`);
            }
        }

        log('');
    }
}

/**
 * 
 * 
 * @param {string} directoryName String with name of directory.
 * @param {moment.Moment} startDate Start date of motion as moment instance.
 * @param {moment.Moment} endDate End date of motion as moment instance.
 */
async function fetchVideos(directoryName, startDate, endDate) {
    const options = {
        targetDirectory: directoryName,
        startDate: startDate.format(format.date),
        endDate: endDate.format(format.date),
        startTime: startDate.format(format.time),
        endTime: endDate.format(format.time)
    };

    await execFetchCommand(options);
}

/**
 * Downloads, transfers and converts recorded videos of detected motion.
 * 
 * @param {object} motion Object with motion entry.
 * @param {number} idx Index of motion entry.
 * @param {number} len Length of motion entries.
 */
async function fetchMedia(motion, idx, len) {
    const dates = getMotionDates(motion);

    let startDate = moment(dates.start);
    let endDate = dates.end ? moment(dates.end) :
        moment(dates.start).add(ipcamsd.minutesIfEndDateIsNull, 'minutes');

    let name = `${startDate.format('YYYYMMDD_HHmmss')}_${endDate.format('HHmmss')}`;

    log('');
    log(chalk.cyanBright.bold.underline(`${padWithZeros(idx + 1, len)}. ${name}`));

    let directoryName = createDirectory(name);

    if (directoryName) {
        const opts = config.options;

        if (opts.snapshots) {
            await fetchSnapshots(directoryName, motion);
        }
        
        if (opts.videos) {
            await fetchVideos(directoryName, startDate, endDate);
        }
    } else {
        log('No actions executed. Directory already exists.');
    }
}

/**
 * Gets motions of API and fetches records with public interface of ipcamsd.
 */
async function fetchRecords() {
    let times = getTimes();
    let { count, data } = await getMotions(times.start, times.end);

    if (Array.isArray(data)) {
        const len = data.length;

        if (motions.reverse) {
            data = data.reverse();
        }

        if (count !== null) {
            log(chalk.magentaBright(`${count} motion${count > 1 ? 's' : ''} found.`));
        }

        for (let i = 0; i < len; i++) {
            const motion = data[i];

            await fetchMedia(motion, i, len);
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
