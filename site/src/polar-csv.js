import {round, vmg2sog} from './util.js';

var CSV_PREAMBLE = 'twa/tws';
var CSV_SEPARATOR = ';';

function zeros (n) {
    return Array.apply(null, new Array(n)).map(function () { return 0.0; });
}

function int (n) {
    return parseInt(n);
}

function float (n) {
    return +n;
}

export function polarimport (str) {
    str = str.trim();

    if (str.indexOf(CSV_PREAMBLE) !== 0) {
        throw 'CSV should start with ' + CSV_PREAMBLE;
    }

    // split by lines, filter empty lines and comments (starting with #)
    var rows = str.split(/\r?\n/).filter(function (s) { return s.length > 0 && s[0] != '#'; });

    var polar = {
        speeds: rows[0].split(CSV_SEPARATOR).slice(1).map(int),
        angles: []
    };

    rows.slice(1).forEach(function (row) {
        var items = row.split(CSV_SEPARATOR);
        var twa = float(items[0]);

        polar.angles.push(twa);
        polar[twa] = items.slice(1).map(float);
    });

    return polar;
}

var vpp;
export function polarexport (data, extended) {
    vpp = ('vpp' in data) ? data.vpp : data;

    var ret = [
        [CSV_PREAMBLE].concat(vpp.speeds),
        zeros(vpp.speeds.length + 1)
    ];

    if (extended) {
        vpp.beat_angle.forEach(function (beat_angle, i) {
            var beat = [beat_angle].concat(zeros(vpp.speeds.length));
            beat[i + 1] = round(vmg2sog(beat_angle, vpp.beat_vmg[i]), 2);
            ret.push(beat);
        });
    }

    vpp.angles.forEach(function (angle) {
        ret.push([angle].concat(vpp[angle]));
    });

    if (extended) {
        vpp.run_angle.forEach(function (run_angle, i) {
            var run = [run_angle].concat(zeros(vpp.speeds.length));
            run[i + 1] = round(vmg2sog(run_angle, -vpp.run_vmg[i]), 2);
            ret.push(run);
        });
    }

    return ret.map(function (row) { return row.join(CSV_SEPARATOR); }).join('\n');
}
