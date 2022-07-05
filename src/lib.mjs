// Copyright (c) 2022, Thorsten A. Weintz. All rights reserved.
// Licensed under the MIT license. See LICENSE in the project root for license information.

import fs from 'fs';
import chalk from 'chalk';
import axios from 'axios';
import moment from 'moment';
import lib from 'ipcamsd';

/**
 * Writes a message to the console
 */
const log = console.log;

/**
 * Object with default configuration parameters
 */
const config = {
    restApi: {
        baseUrl: 'http://192.168.178.96:8000',
        endpoints: {
            motions: {
                path: 'e7b0c7b844bd4fd28e50c3c8dd8a49e5',
                count: 'count',
                entries: 'data',
                reverse: true,
                utc: true,
                keys: {
                    date: 'start'
                },
                limit: 0
            }
        }
    },
    ipcamsd: {
        hosts: [ '192.168.178.30', '192.168.178.31' ],
        auth: {
            username: 'admin',
            password: 'admin'
        },
        minutesIfEndDateIsNull: 3
    },
    format: {
        date: 'YYYYMMDD',
        time: 'HHmmss'
    }
};

/**
 * Adds custom prefix to string value
 * @param {*} value String value 
 * @param {*} prefix Prefix value
 * @param {*} length Length of prefix value
 * @returns 
 */
function setPrefix(value, prefix, length) {
    for (let i = 0; i < (length || 1); i++) {
        value = `${prefix}${value}`;
    }

    return value;
}

/**
 * Gets date instance of Moment.js by command line parameters
 * @param {*} date Date value of command line
 * @returns Value of Moment.js or undefined
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
 * Sets time segments to date instance of Moment.js
 * @param {*} date Date value
 * @param {*} timeStr Time string
 */
function setTime(date, timeStr) {
    if (timeStr && timeStr.length >= 1) {
        let time = moment(timeStr, config.format.time);

        date.set({
            hour: time.get('hour'),
            minute: time.get('minute'),
            second: 0
        });
    }
}

/**
 * Gets times in milliseconds by start and end date command line parameters
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
 * Gets URL to fetch motions by sending HTTP request
 * @param {*} startTime Start time in milliseconds
 * @param {*} endTime End time in milliseconds
 * @param {*} restApi Object with API configuration values
 * @param {*} motions Object with motions configuration values
 * @returns 
 */
function getMotionsUrl(startTime, endTime, restApi, motions) {
    let key = motions.keys.date;

    let queryParams = `?${key}=$gte;${startTime}&${key}=$lte;${endTime}&limit=${motions.limit}`;

    return `${restApi.baseUrl}/${motions.path}${queryParams}`;
}

/**
 * Fetches motions by sending HTTP request
 * @param {*} startTime Start time in milliseconds
 * @param {*} endTime End time in milliseconds
 * @returns Array with motions and count
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
 * Creates directory by name
 * @param {*} name String with target name
 * @returns String with directory name
 */
function createDirectory(name) {
    let directoryName = `./${name}`;

    if (!fs.existsSync(directoryName)) {
        fs.mkdirSync(directoryName);

        return directoryName;
    }
}

/**
 * Executes command to fetch records with public interface of ipcamsd
 * @param {*} ipcamsd Object with ipcamsd configuration values
 * @param {*} dateTime Object with date and time values
 * @param {*} directoryName String with directory name
 */
async function execFetchCommand(ipcamsd, dateTime, directoryName) {
    await lib.fetch(ipcamsd.hosts, {
        auth: ipcamsd.auth,
        fs: {
            directory: directoryName
        },
        dateTime
    });
}

/**
 * Downloads, transfers and converts records by detected motions
 * @param {*} motion Object with motion entry
 * @param {*} idx Index of motion entry
 */
async function downloadRecords(motion, idx) {
    const ipcamsd = config.ipcamsd;

    let startDate = moment(motion.start);
    let endDate = motion.end ? moment(motion.end) :
        moment(motion.start).add(ipcamsd.minutesIfEndDateIsNull, 'minutes');

    let name = `${startDate.format('YYYYMMDD_HHmmss')}_${endDate.format('HHmmss')}`;

    log(chalk.cyanBright(`${('0' + (idx + 1)).slice(-2)}. ${name}`));

    let directoryName = createDirectory(name);

    if (directoryName) {
        const format = config.format;

        const params = {
            date: startDate.format(format.date),
            time: {
                start: startDate.format(format.time),
                end: endDate.format(format.time)
            }
        };

        await execFetchCommand(ipcamsd, params, directoryName);
    } else {
        log(setPrefix('No actions executed. Directory already exists.', ' ', 4));
    }
}

/**
 * Gets motions of API and fetches records with public interface of ipcamsd
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
 * Processes parameters and executes main command
 * @param {*} options Object with options of command line interface
 */
export async function process(options) {
    config.options = options;

    await fetchRecords();
}
