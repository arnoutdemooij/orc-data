import { zip } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { curveCardinal, lineRadial, symbol, symbolCircle, symbolDiamond } from 'd3-shape';
import 'd3-transition';

import { deg2rad, vmg2sog } from './util.js';

export function polarplot(container) {

    var containerElement = document.getElementById(container.substring(1));
    var width = function() { return containerElement.offsetWidth - 20; };
    var height = function() {
        if (window.innerWidth < 768) {
            return window.innerHeight;
        } else {
            return Math.min(window.innerHeight - 60, width() * 2);
        }
    };
    var radius = function() { return Math.min(height() / 2.2 - 20, width()) - 40; };

    var svg = select(container).append('svg')
        .attr('width', width())
        .attr('height', height())
        .append('g')
        .attr('transform', 'translate(' + 10 + ',' + (height() / 2) + ')');

    // radial scale
    var r = scaleLinear().domain([0, 10]).range([0, radius()]);

    // speed rings
    var gr = svg.append('g')
        .attr('class', 'r axis')
        .selectAll('g')
        .data(r.ticks(5).slice(1))
        .enter().append('g');

    gr.append('circle').attr('r', r);

    gr.append('text')
        .attr('y', function(d) { return -r(d) - 4; })
        .attr('transform', 'rotate(15)')
        .style('text-anchor', 'middle')
        .text(function(d) { return d % 2 === 0 ? d + 'kts' : ''; });

    // wind direction
    var graph = svg.append('g')
        .attr('class', 'a axis')
        .selectAll('g')
        .data([0, 45, 52, 60, 75, 90, 110, 120, 135, 150, 165].map(function(d) { return d - 90; }))
        .enter().append('g')
        .attr('transform', function(d) { return 'rotate(' + d + ')'; });

    graph.append('line')
        .attr('x1', r(1))
        .attr('x2', radius());

    var xaxis = function(sel) {
        sel.attr('x', radius() + 6)
            .attr('dy', '.35em')
            .style('text-anchor', function(d) { return d < 270 && d > 90 ? 'end' : null; })
            .attr('transform', function(d) { return d < 270 && d > 90 ? 'rotate(180 ' + (radius() + 6) + ', 0)' : null; })
            .text(function(d) { return (d + 90) + '°'; });
    };

    graph.append('text')
        .attr('class', 'xlabel').call(xaxis);


    var line = lineRadial()
        .radius(function(d) { return r(d[1]); })
        .angle(function(d) { return d[0]; })
        .curve(curveCardinal);

    // Plot VMG diamonds
    var scatter = function(shape, size) {
        return function(s) {
            s.attr('transform', function(d) {
                return 'translate(' + (r(d[1]) * Math.sin(d[0])) + ', ' + (r(d[1]) * -Math.cos(d[0])) + ')';
            });
            s.attr('d', symbol().type(shape || symbolDiamond).size(size || 32));
        };
    };

    var plot = function() {};

    var vpp;
    plot.render = function(data) {
        vpp = ('vpp' in data) ? data.vpp : data;

        var vpp_angles = vpp.angles.map(function(d) { return d * deg2rad; });
        var run_data = [];

        var tws_series = function(cssClass) {
            return function(sel) {
                sel.attr('class', function(d, i) {
                    return cssClass + ' tws-' + vpp.speeds[i];
                });
            };
        };
        var vpp_data = vpp.speeds.map(function(windspeed, i) {
            var series = zip(vpp_angles, vpp.angles.map(function(angle) {
                return vpp[angle][i];
            }));
            // filter points with zero SOG
            series = series.filter(function(a) { return a[1] > 0; });

            const transform = (degrees, vmg) => [degrees * deg2rad, vmg2sog(degrees, vmg)];

            if (vpp.beat_angle) {
                series.unshift(transform(vpp.beat_angle[i], vpp.beat_vmg[i]));
            }
            if (vpp.run_angle) {
                var run = transform(vpp.run_angle[i], -vpp.run_vmg[i]);
                series.push(run);
                run_data.push(run);
            }

            return series.sort(function(a, b) { return a[0] - b[0]; });
        });

        var run_points = svg.selectAll('.vmg-run').data(run_data);
        run_points.exit().remove();
        run_points
            .enter().append('path')
            .call(tws_series('vmg-run'))
            .merge(run_points)
            .transition().duration(200).call(scatter());

        var lines = svg.selectAll('.line').data(vpp_data);
        lines.exit().remove();
        lines
            .enter().append('path')
            .call(tws_series('line'))
            .attr('data-legend', function(d, i) { return vpp.speeds[i] + 'kts'; })
            .attr('data-legend-pos', function(d, i) { return i; })
            .merge(lines)
            .transition().duration(200).attr('d', line);
    };

    var highlight;

    select(window).on('mouseover', function(event) {
        var target = select(event.target);
        var targetClass = target.attr('class');
        var parent = select(event.target.parentNode);
        var parentClass = parent.attr('class');

        if (targetClass && targetClass.substring(0, 4) === 'tws-' && parent && parentClass.substring(0, 4) === 'twa-') {
            var tws = +targetClass.substring(4);
            var twa = +parentClass.substring(4);

            var speed = vpp[twa][vpp.speeds.indexOf(tws)];
            highlight = svg.selectAll('.highlight').data([
                [twa * deg2rad, speed]
            ]);

        } else {
            highlight = svg.selectAll('.highlight').data([]);
        }
        highlight.exit().remove();
        highlight
            .enter().append('path')
            .merge(highlight)
            .attr('class', 'highlight ' + (tws ? 'tws-' + tws : ''))
            .transition().duration(50).call(scatter(symbolCircle, 80));
    });


    var originalSize = width();
    plot.resize = function() {
        if (width() === originalSize) {
            return;
        }
        select('svg')
            .attr('width', width())
            .attr('height', height());

        svg.attr('transform', 'translate(' + 10 + ',' + (height() / 2) + ')');
        r.range([0, radius()]);

        gr.selectAll('.axis.r circle').attr('r', r);
        gr.selectAll('.axis.r text').attr('y', function(d) { return -r(d) - 4; });

        graph.selectAll('line').attr('x2', radius());
        svg.selectAll('.xlabel').call(xaxis);

        svg.selectAll('.line').transition().duration(200).attr('d', line);
        svg.selectAll('.vmg-run').transition().duration(200).call(scatter());

        originalSize = width();
    };

    return plot;
}