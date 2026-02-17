/*
 +-------------------------------------------------------------------------+
 | Copyright (C) 2004-2026 The Cacti Group                                 |
 |                                                                         |
 | This program is free software; you can redistribute it and/or           |
 | modify it under the terms of the GNU General Public License             |
 | as published by the Free Software Foundation; either version 2          |
 | of the License, or (at your option) any later version.                  |
 |                                                                         |
 | This program is distributed in the hope that it will be useful,         |
 | but WITHOUT ANY WARRANTY; without even the implied warranty of          |
 | MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           |
 | GNU General Public License for more details.                            |
 +-------------------------------------------------------------------------+
 | Cacti: The Complete RRDTool-based Graphing Solution                     |
 +-------------------------------------------------------------------------+
 | This code is designed, written, and maintained by the Cacti Group. See  |
 | about.php and/or the AUTHORS file for specific developer information.   |
 +-------------------------------------------------------------------------+
 | http://www.cacti.net/                                                   |
 +-------------------------------------------------------------------------+
*/

const fs = require('fs');
const path = require('path');

// Helper to copy files
function copyFile(src, dest) {
    try {
        // Create directory if it doesn't exist
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy the file
        fs.copyFileSync(src, dest);
        console.log(`Copied: ${src} -> ${dest}`);
    } catch (err) {
        console.error(`Error copying ${src} to ${dest}:`, err.message);
    }
}

// Copy jQuery
console.log('Copying jQuery...');
copyFile(
    'node_modules/jquery/dist/jquery.js',
    'js/devexpress/js/jquery-3.7.1.js'
);
copyFile(
    'node_modules/jquery/dist/jquery.min.js',
    'js/devexpress/js/jquery-3.7.1.min.js'
);

// Copy moment.js
console.log('Copying moment.js...');
copyFile(
    'node_modules/moment/moment.js',
    'js/moment.js'
);
copyFile(
    'node_modules/moment/min/moment.min.js',
    'js/moment.min.js'
);

// Copy vis-network
console.log('Copying vis-network...');
copyFile(
    'node_modules/vis-network/dist/vis-network.min.js',
    'js/visjs/vis-network.min.js'
);
copyFile(
    'node_modules/vis-network/styles/vis-network.min.css',
    'js/visjs/vis-network.min.css'
);

// Copy vis-timeline
console.log('Copying vis-timeline...');
copyFile(
    'node_modules/vis-timeline/dist/vis-timeline-graph2d.min.js',
    'js/visjs/vis-timeline-graph2d.min.js'
);
copyFile(
    'node_modules/vis-timeline/dist/vis-timeline-graph2d.min.css',
    'js/visjs/vis-timeline-graph2d.min.css'
);

console.log('Done copying dependencies!');
