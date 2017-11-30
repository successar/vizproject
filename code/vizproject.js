sigma.classes.graph.addMethod('nodeEdges', function (node) {
    var edges = {};
    var nodes = {};
    var n1 = this.inNeighborsIndex[node.id];
    var n2 = this.outNeighborsIndex[node.id];
    for (var n in n1) {
        nodes[n] = n;
        for (var e in n1[n]) {
            if (!n1[n][e].hidden) {
                edges[e] = n1[n][e];
            }
        }
    }
    for (var n in n2) {
        nodes[n] = n;
        for (var e in n2[n]) {
            if (!n2[n][e].hidden) {
                edges[e] = n2[n][e];
            }
        }
    }

    return edges;
});

var s1 = new sigma({
    settings: {
        drawLabels: false,
        minNodeSize: 1,
        maxNodeSize: 8,
        minEdgeSize: 0,
        maxEdgeSize: 8
    }
});

var s2 = new sigma({
    settings: {
        drawLabels: false,
        minNodeSize: 1,
        maxNodeSize: 8,
        minEdgeSize: 0,
        maxEdgeSize: 8
    }
});

var meta_info = {};

var meta_uniques = {};

var clickedNodeId = '';

function quantile_nodes(array, percentile) {
    index = percentile / 100. * (array.length - 1);
    if (Math.floor(index) == index) {
        result = array[index].betweenness_centrality;
    } else {
        i = Math.floor(index)
        fraction = index - i;
        result = array[i].betweenness_centrality + (array[i + 1].betweenness_centrality - array[i].betweenness_centrality) * fraction;
    }
    return result;
}

var sigmaplot = function (graph, container_name, color, remove_edges) {
    var nodes_list = graph['nodes'],
        edges_list = graph['edges'];

    var sorted_nodes = nodes_list.slice(0).sort(function (a, b) { return b.betweenness_centrality - a.betweenness_centrality; });
    var top10 = quantile_nodes(sorted_nodes, 10);
    var iin = 0, iout = 0;
    for (var i in nodes_list) {
        node = nodes_list[i];
        if (node.betweenness_centrality >= top10) {
            node.centrality_group = 0;
            node.i = iin;
            iin += 1;
        }
        else {
            node.centrality_group = 1;
            node.i = iout;
            iout += 1;
        }
    }
    var s, so, num_s, num_so;
    if (remove_edges) {
        s = s1;
        so = s2;
        num_s = 1;
        num_so = 2;
    }
    else {
        s = s2;
        so = s1;
        num_s = 2;
        num_so = 1;
    }

    s.graph.read({
        nodes: nodes_list,
        edges: edges_list
    });


    var filter = new sigma.plugins.filter(s);
    filter.edgesBy(function (e) {
        return e.weight > 100;
    }, 'edgefilt').apply();

    console.log(
        s.graph.nodes().length,
        s.graph.edges().length
    );

    s.addRenderer({
        type: 'canvas',
        container: container_name
    });

    s.graph.nodes().forEach(function (node, i, a) {
        radius = 1 + node.centrality_group;
        total_length = 0;
        if (node.centrality_group == 1) { total_length = iout; }
        else { total_length = iin; }
        radius += Math.random() / 4;
        node.x = radius * Math.cos(Math.PI * 2 * node.i / total_length);
        node.y = radius * Math.sin(Math.PI * 2 * node.i / total_length);
        node.orig_x = node.x;
        node.orig_y = node.y;
        node.color = color;
        node.orig_color = color;
        node.size = 8;
        node.betweenness = nodes_list[i].betweenness_centrality;
        node.clicked = 0;
        substr = node['id'].substring(1);
        if (substr in meta_info) {
            node.latitude = meta_info[substr]['latitude'];
            if(node.latitude == 'None') node.latitude = 0;
            node.latitude = -node.latitude;
            node.longitude = meta_info[substr]['longitude'];
            if(node.longitude == 'None') node.longitude = 0;
        }
        else {
            node.latitude = 0;
            node.longitude = 0;
        }
    });

    s.graph.edges().forEach(function (edge, i, a) {
        edge.color = '#ccc';
        edge.type = "arrow";
    });

    s.refresh();

    var updateEdges = function () {
        var val = parseInt(document.getElementById('edgefilt').value);
        filter.undo('edgefilt').edgesBy(function (e) {
            return e.weight > val;
        }, 'edgefilt').apply();
    }

    $('#edgefilt').on('input', updateEdges);

    $('#startForce').on('click', function (e) {
        s.startForceAtlas2();
    });

    $('#endForce').on('click', function (e) {
        s.stopForceAtlas2();
    });

    $('#geographicLayout').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            substr = node['id'].substring(1);
            if (substr in meta_info) {
                node.y = node.latitude;
                node.x = node.longitude;
            }
            else {
                node.hidden = true;
            }
        });
        s.refresh();
    });

    $('#circularLayout').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            node.hidden = false;
            node.x = Math.cos(Math.PI * 2 * i / a.length);
            node.y = Math.sin(Math.PI * 2 * i / a.length);
        });
        s.refresh();
    });

    $('#resetLayout').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            node.hidden = false;
            node.x = node.orig_x;
            node.y = node.orig_y;
        });
        s.refresh();
    });

    $('#x').on('change', function (e) {
        field = $('#x').val();
        s.graph.nodes().forEach(function (node, i, a) {
            node.x = node[field];
        });
        s.refresh();
    });

    $('#y').on('change', function (e) {
        field = $('#y').val();
        s.graph.nodes().forEach(function (node, i, a) {
            node.y = node[field];
        });
        s.refresh();
    });

    $('#edgeWeight').on('click', function (e) {
        s.graph.edges().forEach(function (edge, i, a) {
            edge.size = edge.weight;
        });
        s.refresh();
    });

    $('#nodeWeight').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            node.size = node.betweenness_centrality;
            var other_node = so.graph.nodes(node.id);
            var c2 = 0;
            if (typeof other_node != 'undefined') {
                c2 = other_node.betweenness_centrality;
            }
            var diff = c2 - node.betweenness_centrality;
            if (Math.sign(diff) == 1) {
                node.color = '#f00';
            }
            else {
                node.color = '#006400';
            }
            node.orig_color = node.color;

        });
        s.refresh();
    });

    $('#selectRegion').on('change', function (e) {
        var valueSelected = $('#selectRegion').val();
        if (valueSelected == 'None') {
            filter.undo('nodefilt').nodesBy(function (n) {
                return true;
            }, 'nodefilt').apply();
        }
        else {
            filter.undo('nodefilt').nodesBy(function (n) {
                substr = n.id.substring(1);
                if (substr in meta_info) {
                    return meta_info[substr]['country'] == valueSelected;
                }
                return false;
            }, 'nodefilt').apply();
        }
    });


    s.bind("clickNode", function (node) {
        UnclickedNode(s, clickedNodeId);
        UnclickedNode(so, clickedNodeId);
        nodes1 = clickedNode(s, node.data.node.id);
        nodes2 = clickedNode(so, node.data.node.id);
        var innodes1, innodes2, outnodes1, outnodes2;
        if (num_s == 1) {
            var innodes1 = nodes1[0], outnodes1 = nodes1[1];
            var innodes2 = nodes2[0], outnodes2 = nodes2[1];
        }
        else {
            var innodes1 = nodes2[0], outnodes1 = nodes2[1];
            var innodes2 = nodes1[0], outnodes2 = nodes1[1];
        }
        appendInfoList(innodes1, innodes2, outnodes1, outnodes2);
        clickedNodeId = node.data.node.id;
        s1.refresh();
        s2.refresh();
    });

    s.bind("rightClickNode", function (node) {
        UnclickedNode(s, clickedNodeId);
        UnclickedNode(so, clickedNodeId);
        $('#sidebarInfo').removeClass('active');
        s1.refresh();
        s2.refresh();
    });

    s.bind("overNode", function (node) {
        if ('recurse' in node.data) { return; }
        if (typeof so.graph.nodes(node.data.node.id) == 'undefined') { return; }
        so.renderers[0].dispatchEvent('overNode', { node: so.graph.nodes(node.data.node.id), recurse: false });

    });

    s.bind("outNode", function (node) {
        if ('recurse' in node.data) { return; }
        if (typeof so.graph.nodes(node.data.node.id) == 'undefined') { return; }
        so.renderers[0].dispatchEvent('outNode', { node: so.graph.nodes(node.data.node.id), recurse: false });

    });
};

////////////////////////////////////////////////////////////////////////////////////////////

$('#nodesearchbutton').on('click', function (e) {
    var val = document.getElementById('nodesearch').value;
    if (val == 'None' || val == '') {

    }
    else {
        var selected_node = null;
        s1.graph.nodes().forEach(function (node, i, a) {
            if (node.label == val) {
                selected_node = node;
            }
        });
        if (selected_node != null) {
            s1.renderers[0].dispatchEvent('clickNode', { node: selected_node });
            return;
        }
        s2.graph.nodes().forEach(function (node, i, a) {
            if (node.label == val) {
                selected_node = node;
            }
        });
        if (selected_node != null) {
            s2.renderers[0].dispatchEvent('clickNode', { node: selected_node });
            return;
        }
    }
});

var clickedNode = function (s, node_id) {
    var node = s.graph.nodes(node_id);

    if (typeof node == 'undefined') { return [{}, {}, {}]; }
    node.clicked = true;
    var neighbors = {};
    var edges = s.graph.nodeEdges(node);
    var sorted = [];
    var incoming_nodes = {};
    var outgoing_nodes = {};
    for (var i in edges) {
        e = edges[i];
        e.color = '#000';
        neighbors[e.source] = 1;
        neighbors[e.target] = 1;
        sorted[sorted.length] = i;
        if (e.source != node.id) {
            incoming_nodes[e.source] = e;
        }
        if (e.target != node.id) {
            outgoing_nodes[e.target] = e;
        }
    }

    sorted.sort(function (a, b) {
        return - edges[a].weight + edges[b].weight;
    });

    sorted = sorted.slice(0, 5);
    var top_neighbors = {};
    for (var i in sorted) {
        e = edges[sorted[i]];
        top_neighbors[e.source] = 1;
        top_neighbors[e.target] = 1;
    }


    s.graph.nodes().forEach(function (node_p, i, a) {
        if (neighbors[node_p.id]) {
            node_p.color = '#00f';
        }

    });

    node.color = '#0ff';
    var node_info = [];
    substr = node['id'].substring(1)
    if (substr in meta_info) {
        var info = meta_info[substr];
        for (var i in info) {
            j = info[i];
            node_info.push('<li><b>' + i + '</b> : ' + j + '</li>');
        }
    }
    $('#myModalLabel2').html(node.label);
    $('#Label').html('<ul>' + node_info.join('\n') + '</ul>');
    s.refresh();
    return [incoming_nodes, outgoing_nodes];
}

var UnclickedNode = function (s, node_id) {
    var node = s.graph.nodes(node_id);
    if (typeof node == 'undefined') { return; }
    node.clicked = false;
    var neighbors = {};
    var edges = s.graph.nodeEdges(node);
    for (var i in edges) {
        e = edges[i];
        e.color = '#ccc';
        neighbors[e.source] = 1;
        neighbors[e.target] = 1;
    }
    node.color = node.orig_color;
    s.graph.nodes().forEach(function (node_p, i, a) {
        if (neighbors[node_p.id] && !node_p.clicked) {
            node_p.color = node_p.orig_color;
        }
    });
    s.refresh();
}

var getTopN = function (dict, n) {
    var keys = Object.keys(dict);
    keys.sort(function (a, b) {
        return -dict[a].weight + dict[b].weight;
    });

    return keys.slice(0, n);
}

var appendInfoList = function (innodes1, innodes2, outnodes1, outnodes2, top1, top2) {
    var nodes_connected_incoming = [];
    var nodes_connected_outgoing = [];

    var insort1 = getTopN(innodes1, 5), insort2 = getTopN(innodes2, 5);
    var outsort1 = getTopN(outnodes1, 5), outsort2 = getTopN(outnodes2, 5);

    console.log(insort1, insort2);
    s1.graph.nodes().forEach(function (node_p, i, a) {
        if (innodes1[node_p.id]) {
            var node_class = 'nodeinone';
            if (innodes2[node_p.id]) { node_class = 'nodeboth'; }
            var li = '<li class="' + node_class + '" onmouseover="hoverOverNode_s1' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s1' + '(\'' + node_p.id + '\')"'
                + '>' + node_p.label + '</li>';
            if (insort1.includes(node_p.id) || insort2.includes(node_p.id)) {
                nodes_connected_incoming.unshift(li);
            }
            else {
                nodes_connected_incoming.push(li);
            }
        }
        if (outnodes1[node_p.id]) {
            var node_class = 'nodeinone';
            if (outnodes2[node_p.id]) { node_class = 'nodeboth'; }
            var li = '<li class="' + node_class + '" onmouseover="hoverOverNode_s1' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s1' + '(\'' + node_p.id + '\')"'
                + '>' + node_p.label + '</li>';
            nodes_connected_outgoing.push(li);
        }
    });

    s2.graph.nodes().forEach(function (node_p, i, a) {
        if (innodes2[node_p.id] && !innodes1[node_p.id]) {
            node_class = 'nodeintwo';
            var li = '<li class="' + node_class + '" onmouseover="hoverOverNode_s2' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s2' + '(\'' + node_p.id + '\')"'
                + '>' + node_p.label + '</li>';
            if (insort2.includes(node_p.id)) {
                nodes_connected_incoming.unshift(li);
            }
            else {
                nodes_connected_incoming.push(li);
            }
        }
        if (outnodes2[node_p.id] && !outnodes1[node_p.id]) {
            node_class = 'nodeintwo';
            var li = '<li class="' + node_class + '" onmouseover="hoverOverNode_s2' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s2' + '(\'' + node_p.id + '\')"'
                + '>' + node_p.label + '</li>';
            nodes_connected_outgoing.push(li);
        }
    });

    $('#Incoming1').html('<ul>' + nodes_connected_incoming.join('\n') + '</ul>');
    $('#Outgoing1').html('<ul>' + nodes_connected_outgoing.join('\n') + '</ul>');
}

///////////////////////////////////////////////////////////////////////////////////////////

var hoverOverNode_s1 = function (node_id) {
    var n1 = s1.graph.nodes(node_id);
    s1.renderers[0].dispatchEvent('overNode', { node: n1 });
}

var hoverOverNode_s2 = function (node_id) {
    var n1 = s2.graph.nodes(node_id);
    s2.renderers[0].dispatchEvent('overNode', { node: n1 });
}

var hoverOutNode_s1 = function (node_id) {
    var n1 = s1.graph.nodes(node_id);
    s1.renderers[0].dispatchEvent('outNode', { node: n1 });
}

var hoverOutNode_s2 = function (node_id) {
    var n1 = s2.graph.nodes(node_id);
    s2.renderers[0].dispatchEvent('outNode', { node: n1 });
}

//////////////////////////////////////////////////////////////////////////////////////////////
var width_chart = $('#chart').width();
var height_chart = 1500; //$('#chart').height();
var margin = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
},
    width = width_chart - margin.left - margin.right,
    height = height_chart - margin.top - margin.bottom;

var svg = d3.select("#chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g");
//.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

function quantile(array, percentile) {
    index = percentile / 100. * (array.length - 1);
    if (Math.floor(index) == index) {
        result = array[index].diff;
    } else {
        i = Math.floor(index)
        fraction = index - i;
        result = array[i].diff + (array[i + 1].diff - array[i].diff) * fraction;
    }
    return result;
}

var plotbarChart = function () {
    var n1 = s1.graph.nodes();
    var n2 = s2.graph.nodes();
    var nodes = {};
    for (var i in n1) {
        n = n1[i];
        nodes[n.id] = { 'id': n.id };
        nodes[n.id].bc1 = n.betweenness_centrality;
        nodes[n.id].bc2 = 0;
        nodes[n.id].in = 0;
    }
    for (var i in n2) {
        n = n2[i];
        if (nodes[n.id]) {
            nodes[n.id].bc2 = n.betweenness_centrality;
        }
        else {
            nodes[n.id] = { 'id': n.id };
            nodes[n.id].bc2 = n.betweenness_centrality;
            nodes[n.id].bc1 = 0;
            nodes[n.id].in = 1;
        }
    }
    for (var i in nodes) {
        n = nodes[i];
        n.diff = n.bc2 - n.bc1;
    }
    var nodes = $.map(nodes, function (value, key) { return value });
    nodes.sort(function (a, b) { return b.diff - a.diff; });

    var top10 = nodes.filter(d => d.diff > quantile(nodes, 10));
    var bottom10 = nodes.filter(d => d.diff < quantile(nodes, 90));
    var nodes = top10.concat(bottom10);
    //var nodes = nodes.slice(0, 40).concat(nodes.slice(nodes.length - 40, nodes.length));

    var ext = d3.extent(nodes, function (d) { return Math.abs(d.diff); });
    var x = d3.scaleLinear().domain(ext).nice().range([0, width]);

    var y = d3.scaleBand().domain(nodes.map(function (d) { return d.id; }))
        .range([0, height])
        .padding(0.1);

    svg.selectAll(".bar")
        .data(nodes)
        .enter().append("rect")
        .attr("class", function (d) {
            if (d.diff < 0) {
                return "bar negative";
            } else {
                return "bar positive";
            }
        })
        .attr("y", function (d) { return y(d.id); })
        .attr("height", y.bandwidth())
        .attr("width", function (d) { return x(Math.abs(d.diff)) - x(0); })
        .on("mouseover", function (d) {
            if (d.in == 0) {
                hoverOverNode_s1(d.id);
            }
            else {
                hoverOverNode_s2(d.id);
            }
        })
        .on("mouseout", function (d) {
            if (d.in == 0) {
                hoverOutNode_s1(d.id);
            }
            else {
                hoverOutNode_s2(d.id);
            }
        })
        .on("click", function (d) {
            if (d.in == 0) {
                var selected_node = s1.graph.nodes(d.id);
                s1.renderers[0].dispatchEvent('clickNode', { node: selected_node });
            }
            else {
                var selected_node = s2.graph.nodes(d.id);
                s2.renderers[0].dispatchEvent('clickNode', { node: selected_node });
            }
        });

    svg.append("g")
        .attr("class", "y axis")
        .append("line")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y2", width);
}

/////////////////////////////////////////////////////////////////////////////////////////////
var parseMetaInfo = function(meta_data) {
    meta_uniques['country'] = [];
    for(var i in meta_data) {
        node = meta_data[i];
        if(!meta_uniques['country'].includes(node.country)) {
            meta_uniques['country'].push(node.country);
        }
    }
    $.each(meta_uniques['country'], function (index, value) {
        $('#selectRegion').append($('<option/>', { 
            value: value,
            text : value 
        }));
    }); 
}

var append_meta_info = function (graph, meta_data) {
    var nodes = graph['nodes'];
    for (var key in nodes) {
        node = nodes[key];
        if (node['id'].substring(1) in meta_data) {
            node['label'] = meta_data[node['id'].substring(1)]['title'];
        }
        else {
            node['label'] = node['id'];
        }
    }
}

$('#year-button-1').on('click', function (e) {
    var y1 = document.getElementById('year-begin-1').value;
    var y2 = document.getElementById('year-end-1').value;
    var y3 = document.getElementById('year-begin-2').value;
    var y4 = document.getElementById('year-end-2').value;
    d3.json("meta.json", function (meta_data) {
        d3.json(y1 + "-" + y2 + "_betweenness.json", function (data_1) {
            d3.json(y3 + "-" + y4 + "_betweenness.json", function (data_2) {
                meta_info = meta_data;
                parseMetaInfo(meta_data);
                append_meta_info(data_1, meta_data);
                append_meta_info(data_2, meta_data);
                sigmaplot(data_1, "container-1", "#006400", true);
                sigmaplot(data_2, "container-2", "#f00", false);
                plotbarChart();
            });
        });
    });
});



/////////////////////////////////////////////////////////////////////////

function updateYearText(val, textbox) {
    $('#' + textbox).html(val);
}

$(document).ready(function () {

    $('#sidebarCollapse').on('click', function () {
        $('#vertexinfo').removeClass('hidden');
        $('#chartArea').addClass('hidden');
        $('#sidebarInfo').toggleClass('active');
        s1.refresh();
        s2.refresh();
    });

    $('#sidebarCollapse2').on('click', function () {
        $('#vertexinfo').addClass('hidden');
        $('#chartArea').removeClass('hidden');
        $('#sidebarInfo').toggleClass('active');
        s1.refresh();
        s2.refresh();
    });

    $('#sidebarCollapseClose').on('click', function () {
        $('#sidebarInfo').toggleClass('active');
        s1.refresh();
        s2.refresh();
    });

});