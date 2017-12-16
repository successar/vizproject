//import * as d3_timeseries from "d3_timeseries.js"
console.log("Starting to load vizproject.js")

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

var colorCountry = d3.scaleOrdinal(["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#000000"]);
function colorconvert(color, transparency) {
    var r = parseInt(color.substring(1,3),16);
    var g = parseInt(color.substring(3,5),16);
    var b = parseInt(color.substring(5,7),16);
    var a = transparency;
    return ('rgba(' + r + ',' + g + ',' + b + ',' + a + ')');
}


var s1 = new sigma({
    renderer : {
        container: document.getElementById('container-1'),
        type: 'canvas'
    },
    settings: {
        drawLabels: false,
        minNodeSize: 2,
        maxNodeSize: 8,
        minEdgeSize: 0,
        maxEdgeSize: 8,
        defaultEdgeType : 'curvedArrow'    }
});

var s2 = new sigma({
    renderer : {
        container: document.getElementById('container-2'),
        type: 'canvas'
    },
    settings: {
        drawLabels: false,
        minNodeSize: 2,
        maxNodeSize: 8,
        minEdgeSize: 0,
        maxEdgeSize: 8,
        defaultEdgeType : 'curvedArrow'
    }
});

var meta_info = {};

var meta_uniques = {};

var countries = {};

var clickedNodeId = '';

var centralitiesNodeIdMap = {};
var timeSeriesData = [];

d3.json("data/centralitiesAcrossYears_5YrWindow_percentileRank.json",function(data){
    
    centralitiesNodeIdMap = data;
    console.log("centralitiesNodeIdMap[n1] is ",centralitiesNodeIdMap["n1"]);
    
});

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

var sigmaplot = function (graph, remove_edges) {
    var nodes_list = graph['nodes'],
        edges_list = graph['edges'];

    var nodes_with_edges = {};
    $.each(edges_list, function(index, edge){
        nodes_with_edges[edge.source] = 1;
        nodes_with_edges[edge.target] = 1;
    });

    nodes_list.sort(function(a, b){
        aid = meta_info[a.nodeid];
        bid = meta_info[b.nodeid];
        if(typeof aid == 'undefined' && typeof bid == 'undefined') return 0;
        if(typeof aid == 'undefined') return -1;
        if(typeof bid == 'undefined') return 1;
        if(aid.country < bid.country) { return -1; }
        if(aid.country > bid.country) { return 1; }
        if(aid.normplace < bid.normplace) { return -1; }
        if(aid.normplace > bid.normplace) { return 1; }
        return 0;
    });

    nodes_list = nodes_list.filter(node => nodes_with_edges[node.id]);

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
    var s, so, num_s;
    if (remove_edges) {
        s = s1;
        so = s2;
        num_s = 1;
    }
    else {
        s = s2;
        so = s1;
        num_s = 2;
    }

    s.graph.read({
        nodes: nodes_list,
        edges: edges_list
    });


    var filter = new sigma.plugins.filter(s);
    filter.undo('edgefilt').undo('nodefilt').apply();
    filter.edgesBy(function (e) {
        return e.weight > 100 && e.source != e.target;
    }, 'edgefilt').apply();

    console.log(
        s.graph.nodes().length,
        s.graph.edges().length
    );

    s.graph.nodes().forEach(function (node, i, a) {
        radius = 1 + node.centrality_group;
        total_length = 0;
        if (node.centrality_group == 1) { total_length = iout; }
        else { total_length = iin; }
        //radius += Math.random() / 4;
        node.x = radius * Math.cos(Math.PI * 2 * node.i / total_length);
        node.y = radius * Math.sin(Math.PI * 2 * node.i / total_length);
        node.orig_x = node.x;
        node.orig_y = node.y;
        node.size = node.betweenness_centrality;
        node.betweenness = node.betweenness_centrality;
        node.log_betweenness = Math.log(node.betweenness_centrality + 1e-8);
        node.clicked = 0;
        substr = node['nodeid'];
        if (substr in meta_info) {
            node.latitude = meta_info[substr]['latitude'];
            if(node.latitude == 'None') node.latitude = 0;
            node.latitude = -node.latitude;
            node.longitude = meta_info[substr]['longitude'];
            if(node.longitude == 'None') node.longitude = 0;
            node.CountryColor = colorCountry(meta_info[substr]['country']);
            node.color = node.CountryColor;
            node.orig_color = node.color;
        }
        else {
            node.latitude = 0;
            node.longitude = 0;
            node.CountryColor = '#000000';
            node.color = '#000000';
            node.orig_color = '#000000';
        }
        node.longitude = (node.longitude + 180.0) * (5.0/360);
        lat = node.latitude * Math.PI/180;
        mercN = Math.log(Math.tan((Math.PI/4)+(lat/2)));
        node.latitude  = -(5.0/2)+(5.0*mercN/(2*Math.PI));
    });

    s.graph.edges().forEach(function (edge, i, a) {
        edge.color = '#ddd';
        edge.size = edge.weight;
    });

    s.refresh();

    function centerNodes(zoomlevel) {
        var rx = 0, ry = 0, n = 0;
        var maxrx = -1000, minrx = 1000;
        var maxry = -1000, minry = 1000;
        $.each(s.graph.nodes(), function(index, node) {
            if(!node.hidden) {
                maxrx = Math.max(node['read_cam0:x'], maxrx);
                minrx = Math.min(node['read_cam0:x'], minrx);
                maxry = Math.max(node['read_cam0:y'], maxry);
                minry = Math.min(node['read_cam0:y'], minry);
                n += 1
            }
        });
        
        if(n > 0) {
            rx /= n;
            ry /= n;
        }
        
        s.cameras[0].goTo({
            x : (maxrx + minrx)/2, y : (maxry + minry)/2, ratio : zoomlevel, angle : 0
        });
    }
    
    $('#edgefilt').on('input', function(e) {
        var val = parseInt($('#edgefilt').val());
        filter.undo('edgefilt').edgesBy(function (e) {
            return e.weight > val;
        }, 'edgefilt').apply();
    });

    $('#startForce').on('click', function (e) {
        s.startForceAtlas2();
    });

    $('#endForce').on('click', function (e) {
        s.stopForceAtlas2();
        s.cameras[0].goTo({
            x : 0, y : 0, ratio : 1, angle : 0
        });
        s.refresh();
        centerNodes(1);
        s.refresh();
    });

    $('#geographicLayout').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            node.y = node.latitude;
            node.x = node.longitude;
        });
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
    });

    $('#circularLayout').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            node.x = (1) * Math.cos(Math.PI * 2 * i / a.length);
            node.y = (1) * Math.sin(Math.PI * 2 * i / a.length);
        });
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
    });

    $('#jitterLayout').on('click', function(e){
        s.graph.nodes().forEach(function (node, i, a) {
            node.x = node.x + Math.random()/5;
            node.y = node.y + Math.random()/5;
        });
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
    });

    $('#resetLayout').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            node.x = node.orig_x;
            node.y = node.orig_y;
        });
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
    });

    $('#x').on('change', function (e) {
        field = $('#x').val();
        s.graph.nodes().forEach(function (node, i, a) {
            node.x = node[field];
        });
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
    });

    $('#y').on('change', function (e) {
        field = $('#y').val();
        s.graph.nodes().forEach(function (node, i, a) {
            node.y = node[field];
        });
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
    });

    $('#nodeWeight').on('click', function (e) {
        s.graph.nodes().forEach(function (node, i, a) {
            var n1 = s1.graph.nodes(node.id);
            var n2 = s2.graph.nodes(node.id);
            var c2 = 0, c1 = 0;
            if (typeof n2 != 'undefined') {
                c2 = n2.betweenness_centrality;
            }
            if (typeof n1 != 'undefined') {
                c1 = n1.betweenness_centrality;
            }
            
            node.diff = c2 - c1;
        });

        var nodes = s.graph.nodes();
        nodes.sort(function (a, b) { return b.diff - a.diff; });
    
        var top10 = nodes.filter(d => d.diff > quantile(nodes, 10));
        var bottom10 = nodes.filter(d => d.diff < quantile(nodes, 90));

        var top10 = top10.map(d => d.id);
        var bottom10 = bottom10.map(d => d.id);

        $.each(s.graph.nodes(), function(index, node) {
            if(top10.includes(node.id)) {
                node.BetColor = "#1b7837";
            }
            else if(bottom10.includes(node.id)) {
                node.BetColor = "#762a83";
            }
            else {
                node.BetColor = "#bf812d";
            }

        });
        s.refresh();
    });

    $('#nodeColor').on('change', function(e){
        var field = $('#nodeColor').val();
        $.each(s.graph.nodes(), function(index, node){
            if(node.color == node.orig_color) node.color = node[field];
            node.orig_color = node[field]; 
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
                substr = n.nodeid;
                if (substr in meta_info) {
                    return meta_info[substr]['country'] == valueSelected;
                }
                return false;
            }, 'nodefilt').apply();
        }
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
        plotbarChart();
    });

    $('#nodenormplace').on('click', function(e){
        var val = $('#selectnormplace').val();
        if(val == '') {
            filter.undo('nodefilt').nodesBy(function (n) {
                return true;
            }, 'nodefilt').apply();
        }
        else {
            filter.undo('nodefilt').nodesBy(function(n){
                substr = n.nodeid;
                if (substr in meta_info) {
                    return meta_info[substr]['normplace'] == val;
                }
                return false;
            }, 'nodefilt').apply();
        }
        centerNodes(1);
        s.refresh();
        centerNodes(1);
        s.refresh();
        plotbarChart();        
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
        modifyTimeseries(node.data.node.id);
        clickedNodeId = node.data.node.id;
        $('#sidebarCollapse').click();
        s1.refresh();
        s2.refresh();
    });

    s.bind("clickStage", function (node) {
        UnclickedNode(s, clickedNodeId);
        UnclickedNode(so, clickedNodeId);
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

    centerNodes(1);
    s.refresh();
};

////////////////////////////////////////////////////////////////////////////////////////////

$('#nodesearchbutton').on('click', function (e) {
    var val = document.getElementById('nodesearch').value;
    console.log(val);
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
        alert('Paper ' + val + ' not found in given periods');
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
        e.size *= 2
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
        else {
            node_p.color = '#ddd';
        }

    });

    node.color = '#f0f';
    var node_info = [];
    substr = node['nodeid'];
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
        e.color = '#ddd';
        e.size /= 2;
        neighbors[e.source] = 1;
        neighbors[e.target] = 1;
    }
    node.color = node.orig_color;
    s.graph.nodes().forEach(function (node_p, i, a) {
        node_p.color = node_p.orig_color;
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

    s1.graph.nodes().forEach(function (node_p, i, a) {
        if (innodes1[node_p.id]) {
            var node_class = '-';
            if (innodes2[node_p.id]) { node_class = 'o'; }
            var li = '<li onmouseover="hoverOverNode_s1' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s1' + '(\'' + node_p.id + '\')"'
                + ' onclick="clickOnNode_s1'  + '(\'' + node_p.id + '\')"'                
                + '>' + '<b>' + node_class + '</b> ' + node_p.label + '</li>';
            if (insort1.includes(node_p.id) || insort2.includes(node_p.id)) {
                nodes_connected_incoming.unshift(li);
            }
            else {
                nodes_connected_incoming.push(li);
            }
        }
        if (outnodes1[node_p.id]) {
            var node_class = '-';
            if (outnodes2[node_p.id]) { node_class = 'o'; }
            var li = '<li onmouseover="hoverOverNode_s1' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s1' + '(\'' + node_p.id + '\')"'
                + ' onclick="clickOnNode_s1'  + '(\'' + node_p.id + '\')"'                
                + '>' + '<b>' + node_class + '</b> ' + node_p.label + '</li>';
            nodes_connected_outgoing.push(li);
        }
    });

    s2.graph.nodes().forEach(function (node_p, i, a) {
        if (innodes2[node_p.id] && !innodes1[node_p.id]) {
            node_class = '+';
            var li = '<li onmouseover="hoverOverNode_s2' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s2' + '(\'' + node_p.id + '\')"'
                + ' onclick="clickOnNode_s2'  + '(\'' + node_p.id + '\')"'                
                + '>' + '<b>' + node_class + '</b> ' + node_p.label +  '</li>';
            if (insort2.includes(node_p.id)) {
                nodes_connected_incoming.unshift(li);
            }
            else {
                nodes_connected_incoming.push(li);
            }
        }
        if (outnodes2[node_p.id] && !outnodes1[node_p.id]) {
            node_class = '+';
            var li = '<li onmouseover="hoverOverNode_s2' + '(\'' + node_p.id + '\')"'
                + ' onmouseout="hoverOutNode_s2' + '(\'' + node_p.id + '\')"'
                + ' onclick="clickOnNode_s2'  + '(\'' + node_p.id + '\')"'
                + '>' + '<b>' + node_class + '</b> ' + node_p.label + '</li>';
            nodes_connected_outgoing.push(li);
        }
    });

    $('#Incoming1').html('<ul>' + nodes_connected_incoming.join('\n') + '</ul>');
    $('#Outgoing1').html('<ul>' + nodes_connected_outgoing.join('\n') + '</ul>');
}

///////////////////////////////////////////////////////////////////////////////////////////

var modifyTimeseries = function (nodeId){
 
    console.log("Current nodeId is ",nodeId);
    
    currTimeSeries = centralitiesNodeIdMap[nodeId];
    console.log("Updating time series. original timeseries is ",timeSeriesData);
    console.log("Now timeseries length is ",timeSeriesData.length);
    while(timeSeriesData.length > 0) {
        timeSeriesData.pop();
    }
    console.log("Clearing time series. Now timeseries length is ",timeSeriesData.length);
    console.log("Clearing time series. now timeseries is ",timeSeriesData);
    for (var i = 0; i< currTimeSeries.length; i++){
        timeSeriesData.push({date:new Date((1836+i).toString()),n:currTimeSeries[i]});
        //timeSeriesData.push({date:(1836+i),n:currTimeSeries[i]});
    }
    console.log("Updating time series. new timeseries is ",timeSeriesData);
    console.log("Now timeseries length is ",timeSeriesData.length);
    
    $('#bottombarRefresh').click();
    console.log($('#timeseries-chart svg').width());
    $('#outer').width($('#timeseries-chart svg').width()+30);
}


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

var clickOnNode_s1 = function(node_id) {
    var n1 = s1.graph.nodes(node_id);
    s1.renderers[0].dispatchEvent('outNode', { node: n1 });    
    s1.renderers[0].dispatchEvent('clickNode', { node: n1 });
}

var clickOnNode_s2 = function(node_id) {
    var n1 = s2.graph.nodes(node_id);
    s2.renderers[0].dispatchEvent('outNode', { node: n1 });        
    s2.renderers[0].dispatchEvent('clickNode', { node: n1 });
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
        if(!n.hidden) {
            nodes[n.id] = { 'id': n.id };
            nodes[n.id].bc1 = n.betweenness_centrality;
            nodes[n.id].bc2 = 0;
            nodes[n.id].in = 0;
        }
    }
    for (var i in n2) {
        n = n2[i];
        if(!n.hidden) {
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

    $('#chart').html('');
    var svg = d3.select("#chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g");

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
    meta_uniques['normplace'] = [];
    countries = {};
    for(var i in meta_data) {
        node = meta_data[i];
        lat = node.latitude;
        long = node.longitude;
        if(lat == 'None' || long == 'None') {lat = 0; long = 0;}
        if(!meta_uniques['country'].includes(node.country)) {
            meta_uniques['country'].push(node.country);
            countries[node.country] = {};
            countries[node.country].lat = lat;
            countries[node.country].long = long;
            countries[node.country].n = 0.0;
        }
        else {
            countries[node.country].lat += lat;
            countries[node.country].long += long;
        }
        countries[node.country].n += 1;
        if(!meta_uniques['normplace'].includes(node.normplace)){
            meta_uniques['normplace'].push(node.normplace);
        }
    }
    $.each(meta_uniques['country'], function (index, value) {
        countries[value].lat /= countries[value].n;
        countries[value].long /= countries[value].n;
    }); 
}

var append_meta_info = function (graph, meta_data) {
    var nodes = graph['nodes'];
    for (var key in nodes) {
        node = nodes[key];
        if (node['nodeid'] in meta_data) {
            node['label'] = meta_data[node['nodeid']]['title'];
        }
        else {
            node['label'] = node['id'];
        }
        
    }
}

var emptySigma = function() {
    s1.graph.clear();
    s2.graph.clear();
    $('.widgets, .widgets *').off();
}

$('#year-button-1').on('click', function (e) {
    $('#spin').addClass('spinner');
    resetForms();
    var y1 = document.getElementById('year-begin-1').value;
    var y2 = document.getElementById('year-end-1').value;
    var y3 = document.getElementById('year-begin-2').value;
    var y4 = document.getElementById('year-end-2').value;
    d3.json("data/meta.json", function (meta_data) {
        var select = d3.select("#mylist")
        var nodeList = [];
        populateNodeList(meta_data, nodeList);
       
       select.selectAll("option")
            .data(nodeList)
            .enter()
            .append("option")
            .attr("value", function (d) { return d; })
            .text(function (d) { return d; });
        d3.json("data/years/aggregateNetwork_" + y1 + "_" + y2 + "_filtered.json", function (data_1) {
            d3.json("data/years/aggregateNetwork_" + y3 + "_" + y4 + "_filtered.json", function (data_2) {
                meta_info = meta_data;
                parseMetaInfo(meta_data);
                append_meta_info(data_1, meta_data);
                append_meta_info(data_2, meta_data);
                emptySigma();
                sigmaplot(data_1, true);
                sigmaplot(data_2, false);
                $('#nodeWeight').click();
                plotbarChart();
                $('#spin').removeClass('spinner');
                
            });
        });
    });
});





/////////////////////////////////////////////////////////////////////////

function updateYearText(val, textbox) {
    $('#' + textbox).html(val);
}

$(document).ready(function () {
    resetForms();
    $('#sidebarCollapse').on('click', function () {
        $('#vertexinfo').removeClass('hidden');
        $('#chartArea').addClass('hidden');
        $('#sidebarInfo').removeClass('active');
        s1.refresh();
        s2.refresh();
    });

    $('#sidebarCollapse2').on('click', function () {
        $('#vertexinfo').addClass('hidden');
        $('#chartArea').removeClass('hidden');
        $('#sidebarInfo').removeClass('active');
        s1.refresh();
        s2.refresh();
    });

    // $('#centrality-button-1').on('click', function () {
    //     $('#bottombarInfo').removeClass('hidden');
    //     s1.refresh();
    //     s2.refresh();
    // });
    
    $('#sidebarCollapseClose').on('click', function () {
        $('#sidebarInfo').addClass('active');
        s1.refresh();
        s2.refresh();
    });

    $('#sidebarCollapseClose2').on('click', function () {
        $('#sidebarInfo').addClass('active');
        s1.refresh();
        s2.refresh();
    });

    // $('#sidebarCollapseClose3').on('click', function () {
    //     $('#bottombarInfo').addClass('hidden');
    //     s1.refresh();
    //     s2.refresh();
    // });

});

var populateNodeList = function(meta_data,nodeList) {
    for(var i in meta_data) {
        node = meta_data[i];
        nodeList.push(node.title);
    }
}

function resetForms() {
    forms = $('#myModal form');
    for (i = 0; i < forms.length; i++) {
        forms[i].reset();
    }
}
