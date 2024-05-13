#!/usr/bin/env node

// Copyright (c) 2023, Thorsten A. Weintz. All rights reserved.
// Licensed under the MIT license. See LICENSE in the project root for license information.

import { program } from 'commander';
import { process } from './lib.mjs';

program
    .name('movids')
    .version('1.5.0', '-v, --version')
    .requiredOption('--start-date <yyyymmdd|today|yesterday>', 'start date of records')
    .requiredOption('--start-time <hhmm>', 'start time of records')
    .requiredOption('--end-date <yyyymmdd|today|yesterday>', 'end date of records')
    .requiredOption('--end-time <hhmm>', 'end time of records')
    .option('--no-snapshots', 'skip fetching snapshots')
    .option('--no-videos', 'skip fetching videos')
    .parse();

const options = program.opts();

await process(options);
