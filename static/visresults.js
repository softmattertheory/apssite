
// Function used to remove duplicates from a set
function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

// Compares start times for sorting
function comparestarttimes(a,b) {
  return a.start - b.start
}

// Finds the sessions from a query
function findsessionsfromsearch(search) {
  return search.map( (x) => x.session ).filter(onlyUnique)
}

// Find unique sessions from a collection
function findsessions(collection) {
  return collection.map( (x) => x.id ).filter(onlyUnique)
}

// Orders sessions
function ordersessions(sessions, collection) {
   const sessheaders = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
   // Get the unique sessions
   const sess=findsessions(collection);
   // Split them into an array of arrays
   const sarray=sessheaders.map( (x) => sess.filter((y) => y.includes(x)) );
   // Find their position in the array and return this as a dictionary
   var out = {};
   for (const v of sarray) {
      v.map((x,i) => out[x]=i);
   }
   return out;
}

// Find the maximum number of parallel sessions
function findmaxparallel(collection) {
  const sessheaders = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  // Get the unique sessions
   const sess=findsessions(collection);
   // Split them into an array of arrays
   const sarray=sessheaders.map( (x) => sess.filter((y) => y.includes(x)) );

   return Math.max(...sarray.map((x) => x.length))
}

// Finds the talks for a given query
function talksforquery(talks, search) {
  // Identify the session from the search
  const srchsessions = findsessionsfromsearch(search);
  function talksforsession(sess) {
    return talks.filter((x) => x.id.includes(sess))
  }
  return srchsessions.map(talksforsession).flat()
}

// Generates and inserts the SVG file into the document
function draw(container, query, sessions, talks) {
  // Parameters about the display
  const width = 800;
  const height = 600;
  const margin = ({top: 16, right: 0, bottom: 16, left: 40});

  /* **************************************
   * Process the query
   **************************************** */

  const showtalks = talksforquery(talks, query);
  const sessorder = ordersessions(sessions, showtalks);
  const maxparallel=findmaxparallel(showtalks);

  /* **************************************
   * Highlight talks that are the result of the search
   **************************************** */

  const scores=query.map((x) => +x.score);
  const scoremin=Math.max(scores[scores.length-1]-0.1,0);
  const scoremax=scores[0];

  function talksforsession(sess) {
    return talks.filter((x) => x.id.includes(sess))
  }

  // Compute the color to display a talk given the color
  function colorforscore(score) {
    const c = (score-scoremin)/(scoremax-scoremin);
    var c1=[210, 210, 210];
    var c2=[17, 103, 177];
    var cc=[Math.round(c1[0]+c*(c2[0]-c1[0])),Math.round(c1[1]+c*(c2[1]-c1[1])),Math.round(c1[2]+c*(c2[2]-c1[2]))];
    return ["rgb(", cc[0],",",cc[1],",",cc[2],")"].join("")
  }

  for (var s of query) {
    var tlks=talksforsession(s.session);
    var stlks=tlks.sort(comparestarttimes);
    var tfound=stlks[s.event-1];
    tfound.color = colorforscore(+s.score);
  }

  /* **************************************
   * Create the y axis
   **************************************** */
  const format = d3.utcFormat("%-I %p");
  const formatHours = (hours) => format(new Date(hours * 1000 * 60 * 60));

  const y = d3.scaleLinear()  // Scale the values
    .domain([8, 12+6])
    .rangeRound([margin.top, height - margin.bottom]);

  const yAxis = g => g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)
          .ticks(12+6-8)
          .tickFormat(formatHours)
          .tickSize(-width + margin.left + margin.right)
          .tickPadding(10))
      .call(g => g.selectAll(".domain, .tick:first-of-type, .tick:last-of-type").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#fff").attr("stroke-width", 0.5));

  /* **************************************
   * Create the x axis
   **************************************** */
  const formatDay = d3.timeFormat(width < 500 ? "%a" : "%A %d")

  const x = d3.scaleTime()
     .domain([
       d3.timeDay.floor(d3.min(sessions, d => d.start)), d3.timeDay.ceil(d3.max(sessions, d => d.end))
     ])
     .rangeRound([margin.left, width - margin.right])
     .nice()

  const xAxis = g => g
      .attr("transform", `translate(0,${margin.top})`)
      .call(d3.axisTop(x)
          .ticks(6)
          .tickFormat(formatDay)
          .tickPadding(0))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick text")
          .attr("text-anchor", "start")
          .attr("x", 6)
          .attr("dy", null));


  /* **************************************
   * Functions for rectangle layout
   **************************************** */

  function timeToY(x) {
    return x.getHours()+x.getMinutes()/60;
  }

  const rectwidth = (width-100)/6/maxparallel;
  const rectspacing = 2;

  function sessionToX(d) {
    let sessionnumber = sessorder[d.id];
    let daystart = d3.timeDay.floor(d.start);
    return x(daystart)+(sessionnumber)*(rectwidth+rectspacing);
  }

  const tooltip = d3
        .select('body')
        .append('div')
        .style('position', 'absolute')
        .style('z-index', '10')
        .style('visibility', 'hidden')
        .style('padding', '5px')
        .style('background', 'rgba(0,0,0,0.3)')
        .style('border-radius', '2px')
        .style('color', '#fff');

  /* **************************************
   * Create the SVG
   **************************************** */
  const svg = d3.select(container).append('svg')
    //.attr("viewBox", `0 0 300 500`)
     .attr('width',width)
     .attr('height',height)

  const g = svg.append("g")
    .selectAll("path")
    .data(showtalks)
    .join("g")
      .attr("fill", function(event, d, i) {
          return event.color;
        })
    .on("mouseover",
        function (event, d, i) {
          event.currentTarget.style.fill = "rgb(0, 0,0)";
          tooltip.html(`<div style="font-family:helvetica;font-size:12">${d.id}: ${d.title}</div>`).style('visibility', 'visible');
        })
    .on('mousemove',
        function (e) {
          tooltip
            .style('top', e.pageY + 10 + 'px')
            .style('left', e.pageX + 10 + 'px');
        })
    .on("mouseout",
        function (event) {
           event.currentTarget.style.fill = "";
           tooltip.html(``).style('visibility', 'hidden');
        });

  g.append("rect")
    .attr("width", rectwidth)
    .attr("height", function(d) { return y(timeToY(d.end))-y(timeToY(d.start)) })
    .attr("x", function(d) { return sessionToX(d) })
    .attr("y", function(d) { return y(timeToY(d.start)) });

  svg.append("g")
      .attr("pointer-events", "none")
      .call(yAxis);

  svg.append("g")
      .attr("pointer-events", "none")
      .call(xAxis);

  return svg.node();
}

// Display the results by first loading necessary data then calling the draw function
function displayResults(container, query) {
  var parseTime = d3.timeParse("%Y-%m-%dT%H:%M");

  const spromise = d3.text("/static/sessionsmonfri.txt");
  const tpromise = d3.text("/static/talks.txt");

  Promise.all([spromise, tpromise]).then((values) => {
    var sessions = d3.csvParseRows(values[0], function (d, i) {
      return {
        id: d[0],
        title: d[1].replace(/<\/?[^>]+(>|$)/g, ""),
        start: parseTime(d[2].replace(/\s+/g, '')),
        end: parseTime(d[3].replace(/\s+/g, '')),
        unit: d[4],
        tags: d[5]
      }
    });
    var talks = d3.csvParseRows(values[1], function (d, i) {
      return {
       id: d[0],
       title: d[3].replace(/<\/?[^>]+(>|$)/g, ""),
       start: parseTime(d[1].replace(/\s+/g, '')),
       end: parseTime(d[2].replace(/\s+/g, '')),
       authors: d[4],
       units: d[5],
       tags: d[6],
       color: "rgb(210,210,210)"
      }
    });
    draw(container, query, sessions, talks);
  });
}
