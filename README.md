# movids

[![npm](https://img.shields.io/npm/v/movids)](https://www.npmjs.com/package/movids)
![npm](https://img.shields.io/npm/dw/movids?label=↓)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/aoephtua/movids/blob/master/LICENSE)

Node.js command line tool and library for fetching records of IP cameras by motion detection.

Detected dates are fetched over HTTP requests and can be stored in databases.

## Installation

    $ npm install -g movids

## Usage

### Command

Transfers and converts records of the specified parameters.

    $ movids --start-date [YYYYMMDD|today|yesterday] --start-time [HHMM] --end-date [YYYYMMDD|today|yesterday] --end-time [HHMM]

### General Options

```
Options:
  -v, --version                            output the version number
  --start-date <yyyymmdd|today|yesterday>  start date of records
  --start-time <hhmm>                      start time of records
  --end-date <yyyymmdd|today|yesterday>    end date of records
  --end-time <hhmm>                        end time of records
  --no-snapshots                           skip fetching snapshots
  --no-videos                              skip fetching videos
  -h, --help                               display help for command
```

### Configuration

```
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
```

## License

This project is licensed under [MIT](https://github.com/aoephtua/movids/blob/master/LICENSE).