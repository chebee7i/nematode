/* Javascript for Nematode Scavenger Hunt

Keep in mind that there are 5 coordinate systems in play.

1. Matrix coordinates: (i,j)

    This mostly applies only for the grid. We have a box at position (i,j),
    where i increases downward, and j increases rightward. A value of (3,5)
    means we are looking at the box in row 5, column 5, with (0,0) in the
    upper-left corner.

2. Abstract box coordinates: (a,b)

    This is a abstract coordinate system similar to SVG's pixel coordinate
    system. The idea is that we use the desire width and height of the DOM
    element that will receive the plot, to scale these abstract coordinates
    to actual pixel values (relative to the SVG element in the DOM element).
    The coordinate a increases rightward and is similar to the x-axis, while
    b increases downward and is similar to a negated y-axis. A value of (3,5)
    means that this we are working with the box 3 units rightward and 5 units
    downward, from the upper-left corner of the grid.

3. Pixel coordinates (u,v)

    From the abstract box coordinates, we scale them according to the desired
    element width and height. The coordinate u increases rightward and is
    similar to the x-axis, while b increases downward and is similar to a
    negated y-axis. A value of (3,5) represents a position that is 3 pixels
    rightward and 5 pixels downward from the upper-left corner of the grid.

4. Real space (x,y)

    The x and y coordinates are used by the function that we are discretizing.
    So this is typical. The coordinate x increases rightward and y increases
    upward.

5. Grid space (m,n)

    Finally, we have grid space. This is a user-facing space and the idea is
    that we want to shield real space from the user and present a very simple
    integer-based coordinate system. We *could* use matrix or box coordinates,
    but neither of these is oriented in way that is familiar to most people.
    So we want m to increase rightward and n to increase upward. This puts
    (0,0) at the bottom left of the grid.

*/

var nematode = {};
(function(context) {
    "use strict";

    function makeid()
    {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for( var i = 0; i < 5; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }

    /* Create a Gaussian-like function of the following form:
     *
     *   z(x,y) = A * exp(-(x-x_0)^2 / (2 \sigma_x) - (y-y_0)^2 / (2 \sigma_y))
     *
     * x and y are coordinates in real space.
     * x_0 and y_0 specify the center.
     * sigma_x and sigma_y are the diagonals of a covariance matrix.
     * A is the amplitude.
     *
     * Use as:
     *    var z = createGaussian(10, 0, 0, 1, 1);
     *
     */
    function createGaussian(A, x0, y0, sigmax, sigmay) {

        var func = function(x, y) {
            var xstuff = Math.pow((x-x0),2) / (2 * Math.pow(sigmax,2));
            var ystuff = Math.pow((y-y0),2) / (2 * Math.pow(sigmay,2));
            return A * Math.exp(-(xstuff + ystuff));
        }
        return func;
    }

    /* Create the discretized landscape from `func`. xMin, xMax, yMin and yMax
     * are all coordinates in real space. `func` is what is used to determine
     * the z-values of the matrix.
     *
     * Example: Create a landscape that has two Gaussians in it.
     *    var z1 = createGaussian(10, 1, 0, 1, 1);
     *    var z2 = createGaussian(-10, 0, 1, 1, 1);
     *    var myfunc = function(x,y) {
     *        return z1(x,y) + z2(x,y);
     *    }
     *    var lscape = createLandscape(myfunc, 10, 10, -3, 3, -3, 3);
     *
     */
    function createLandscape(func, nRows, nCols, xMin, xMax, yMin, yMax) {
        var arr = [];

        // i increases downward, but y increases upward, so we reverse.
        // This makes the 0th row correspond to the maximum y.
        var rows = d3.range(nRows).reverse();
        var cols = d3.range(nCols);
        // We still need to shift the evaluation point by half the range band.
        var j_to_x = d3.scale.ordinal().domain(cols).rangeBands([xMin, xMax]);
        var i_to_y = d3.scale.ordinal().domain(rows).rangeBands([yMin, yMax]);

        var minz = Infinity;
        var maxz = -Infinity;
        for (var i=0; i < nRows; i++) {

            // Add the row.
            arr.push([]);

            // Add the columns.
            arr[i].push( new Array(nCols));

            for(var j = 0; j < nCols; j++){
                // x,y refer to real space
                // i,j are matrix coordinates
                // We need to pass real space coordinate to func.
                // We shift by half the rangeBand so we are in the center
                // of the squares.
                var x = j_to_x(j) + j_to_x.rangeBand() / 2;
                var y = i_to_y(i) + i_to_y.rangeBand() / 2;
                var z = func(x,y);
                if (z < minz) {
                    minz = z;
                }
                if (z > maxz) {
                    maxz = z;
                }
                arr[i][j] = {
                    i: i, j: j,             // matrix
                    a: j, b: i,             // abstract box
                    x: x, y: y, z: z,       // real
                    m: j, n: nRows - i - 1, // grid
                };
            }
        }

        var landscape = {
            nRows: nRows, nCols: nCols,
            attr: "z", min: minz, max: maxz,
            matrix: arr
        };

        return landscape;
    }

    function Environment(landscape, elementID, width, height, positionID) {
        this.landscape = landscape;
        this.elementID = elementID;
        this.positionID = positionID;

        // Self-reference private variable for inner functions.
        var that = this;

        // The desired width and height of the environment's element.
        this.width = width;
        this.height = height;

        this.colormap = getColormap();
        this.draw();

        function getColormap() {
            // Configure a colormap mapping landscape heights to colors.
            var attr_domain = [landscape.min, landscape.max];
            /** The goal here is to create mapping from z to colors **/
            var niceDomain = d3.scale.linear().domain(attr_domain).nice().domain();
            // This is a mapping from 11 categories to equally spaced regions in the domain.
            var linspace = d3.scale.linear().domain([0,9]).range(niceDomain);
            // These are the 9 samples of the domain.
            var polyDomain = d3.range(9).map(linspace);
            // This is map from the attr space to color space.
            var c = d3.scale.linear().domain(polyDomain).range(colorbrewer.Blues[9]).clamp(true);
            return c;
        }

    }

    // Returns the wrapped matrix coordinates.
    Environment.prototype.getMatrixCoordinates = function(i, j) {
        var nRows = this.landscape.nRows;
        var nCols = this.landscape.nCols;

        var ii = i % nRows;
        if (ii < 0) {
            ii = nRows + ii;
        }

        var jj = j % nCols;
        if (jj < 0) {
            jj = nCols + jj;
        }

        return {i: ii, j: jj};
    }

    /* Returns the square object at matrix coordinate i,j.
     *
     * Note: (i,j) will be remapped back onto the grid, as necessary.
     *
     */
    Environment.prototype.getSquare = function(i, j) {
        var ii = i % this.landscape.nRows;
        if (ii < 0) {
            ii = this.landscape.nRows + ii;
        }
        var jj = j % this.landscape.nCols;
        if (jj < 0) {
            jj = this.landscape.nCols + jj;
        }
        return this.landscape.matrix[ii][jj];
    }

    Environment.prototype.draw = function() {
        var c = this.colormap;
        var attr   = this.landscape.attr,
            nRows  = this.landscape.nRows,
            nCols  = this.landscape.nCols,
            matrix = this.landscape.matrix;

        // Margins around the landscape
        var margin = {top: 10, right: 10, bottom: 10, left: 10};

        // This represents pixel space.
        // Map the i:j matrix coordinates to pixel coordinates v:u.
        var j_to_u = d3.scale.ordinal().rangeBands([0, this.width]),
            i_to_v = d3.scale.ordinal().rangeBands([0, this.height]);
        j_to_u.domain(d3.range(nCols));
        i_to_v.domain(d3.range(nRows));

        d3.select(this.elementID).on("mousedown", function(){
            d3.event.preventDefault();
        });

        // Remove everything from the element.
        $(this.elementID).empty();

        // Create the SVG element with the proper dimensions.
        var svg = d3.select(this.elementID).append("svg")
            .attr("width", this.width + margin.left + margin.right)
            .attr("height", this.height + margin.top + margin.bottom)
            .style("margin-left", -margin.left + "px")
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // Now we add the elements
        svg.append("rect")
            .attr("class", "background")
            .attr("width", this.width)
            .attr("height", this.height);

        // For each row in landscape, create a row.
        var row = svg.selectAll(".row")
            .data(matrix)
            .enter().append("g")
            .attr("class", "row")
            .attr("transform", function(d, i) { return "translate(0," + i_to_v(i) + ")"; })

        var that = this;
        var rowHandler = function(row) {
            d3.select(this).selectAll(".cell")
                .data(row)
                .enter().append("rect")
                .attr("class", "cell")
                .attr("x", function(d, j) { return j_to_u(j); })
                .attr("width", j_to_u.rangeBand())
                .attr("height", i_to_v.rangeBand())
                .style("fill-opacity", 1)
                .style("fill", function(d) { return c(d[attr]); })
                .on("mouseover", function(p) {
                    that.setPositionText(p);
                })
                .append("title").text(function (d) {
                    return d[attr].toFixed(3);
                });
        }
        row.each(rowHandler);

        // Add a line after each row.
        row.append("line").attr("x2", this.width);

        // Now create columns. For now, this is basic. All we do is add a line.
        var column = svg.selectAll(".column")
            .data(d3.range(nCols))
            .enter().append("g")
            .attr("class", "column")
            .attr("transform", function(d, j) { return "translate(" + j_to_u(j) + ", 0)"; });

        // Add a line after each column.
        column.append("line").attr("y1", this.height);

    }

    Environment.prototype.setPositionText = function(d) {
        $(this.positionID).html("(" + d.m + ", " + d.n + ")");
    }

    Environment.prototype.updatePositionMarker = function(nematode, d) {
        var selector = "#currentPosition_" + nematode.elementID.substr(1);
        var circle = d3.select(selector);
        //circle.attr("visibility", "visible");

        // This represents pixel space.
        // Map the i:j matrix coordinates to pixel coordinates v:u.
        var j_to_u = d3.scale.ordinal().rangeBands([0, this.width]),
            i_to_v = d3.scale.ordinal().rangeBands([0, this.height]);
        j_to_u.domain(d3.range(this.landscape.nCols));
        i_to_v.domain(d3.range(this.landscape.nRows));

        var cx = j_to_u(d.j) + j_to_u.rangeBand() / 2;
        var cy = i_to_v(d.i) + i_to_v.rangeBand() / 2;
        circle.attr("cx", cx);
        circle.attr("cy", cy);

    }

    Environment.prototype.bindNematode = function(nematode) {

        // Add a circle to the svg element to represent the nematode position.
        var j_to_u = d3.scale.ordinal().rangeBands([0, this.width]);
        j_to_u.domain(d3.range(this.landscape.nCols));
        var radius = j_to_u.rangeBand() / 4.0;
        d3.select(this.elementID + " g")
            .append("circle")
            .attr("id", "currentPosition_" + nematode.elementID.substr(1))
            //.attr("visibility", "hidden")
            .attr("r", radius)
        ;
        var pos = nematode.positions[nematode.positions.length - 1];
        this.updatePositionMarker(nematode, this.getSquare(pos.i, pos.j));

        /*
           Make clicks on cells of the environment set a new position
           for the nematode. Note, all nemotodes with the same environment
           will be affected simultaneously.
        */
        var colormap = this.colormap;
        var attr = this.landscape.attr;
        var eventns = "click." + nematode.elementID.substr(1);
        var that = this;


        var rowHandler = function(row) {
            /* Note this is a function expression, so the function definition
             * is not hoisted (but the variable is). This allows us to declare
             * other variables before it (such as colormap, attr, etc). Had
             * we used a function declaration, then it would have been hoisted
             * and we would not have been able to use outside variables.
             * http://www.adequatelygood.com/JavaScript-Scoping-and-Hoisting.html
             */

            // "this" refers to the <g class="row" ...> element.
            d3.select(this).selectAll(".cell")
                .data(row)
                .on(eventns, function(d) {
                    // "this" now refers to the <rect> element.
                    nematode.setPosition(d.i, d.j);
                    nematode.draw();
                    // Simulate click.
                    for (var i = 0; i < nematode.clickCallbacks.length; i++) {
                        // Call the callback, passing the nematode as "this".
                        nematode.clickCallbacks[i].call(nematode);
                    }
                    d3.select(this)
                        .transition().duration(50).style("fill", "black")
                        /* Unlike when clicking a cell in the nematode,
                         * we do not redraw the whole grid. So we must
                         * restore the color of the cell.
                         *
                         * Note: Since this gets called quickly for each
                         * nematode, the "end" signals interrupt each other.
                         * The result is that this callback is called only for
                         * the last nematode assigned to the environment.
                         * This means that we cannot call nematode.draw()
                         * inside the call back, but that is fine since we
                         * don't need the nematode draw to occur after the
                         * quick fill flash of the environment cell.
                         *
                         */
                        .each("end", function() {
                            d3.select(this).style("fill", colormap(d[attr]));
                        });

                    // Update position marker on environment.
                    that.updatePositionMarker(nematode, d);

                });

        }

        d3.selectAll(this.elementID + " " + ".row")
            .data(this.landscape.matrix)
            .each(rowHandler);

    }

    /** Basic nematode.
     *
     * Possible movements are up, down, left, right, stay: U, D, L, R, S.
     *
     * However, these movements are defined with respect to the global
     * landscape. So "up" means to move in an upward direction. Due to the
     * torus, moving upward on the top row teleports down to the bottom row.
     * Similarly, "left" means to move in a leftward direction. The nematodes
     * are always facing in the direction they are moving---so they are always
     * moving "forward", independent of movement label.
     *
     */
    function Nematode(environment, elementID, width, height, variant, i, j) {

        // Self-reference private variable for inner functions.
        var that = this;

        // Keep track of number of organisms for namespace binding.
        Nematode.count = (Nematode.count || 0) + 1;

        this.environment = environment;
        this.elementID = elementID;
        this.width = width;
        this.height = height;
        this.clickCallbacks = [];

        // Make sure we have a valid variant if one is not provided.
        variant = typeof variant !== 'undefined' ? variant : "0";
        this.variant = variant;

        this.setPosition(i, j);
        this.draw();

        environment.bindNematode(this);
    }

    /* Returns the an object suitable for draw().
     *
     * For the basic nematode, the set of possible movements we consider:
     *      Up, Down, Left, Right, Stay
     * Each of these movements will take the nematode to some "next" position.
     * We also restrict the locations that the nematode has knowledge about to
     * be a subset of the possible "next" positions. (There's no reason these
     * features need to be coupled. For example, we could have a nematode with
     * the ability to jump, thus skipping one square, but keep its vision
     * restricted to the nearest neighbors. We could also have a nematode that
     * can see the ring of positions around it, even though it can only move
     * in the basic way we consider here.)
     *
     * For implementation, we consider a 3x3 grid, with boxes labeled:
     *
     *     012
     *     345
     *     678
     *
     * where the nematode's current position is box 4. Next possible locations
     * are boxes 1,3,4,5,7. Depending on the type of nematode, some of the
     * next possible locations might be assigned the class "ignorant" to
     * signify that the nematode has no knowledge of the value of the
     * landscape at that location.
     *
     */
    Nematode.prototype.getSquares = function(i, j) {

        var env = this.environment;

        // We must remap the box positions onto a 3x3 grid.
        // So box 1 is at (0,1), box 3 is at (1,0), and so on.
        var squares = [
            // Note: We don't need to worry about wrapping coordinates.
            {i: 0, j:1, movement: 'U', cell: env.getSquare(i-1, j+0)},
            {i: 1, j:0, movement: 'L', cell: env.getSquare(i+0, j-1)},
            {i: 1, j:1, movement: 'S', cell: env.getSquare(i+0, j+0)},
            {i: 1, j:2, movement: 'R', cell: env.getSquare(i+0, j+1)},
            {i: 2, j:1, movement: 'D', cell: env.getSquare(i+1, j+0)},
        ];

        var idx;
        var ignorant = [];

        var variant = this.variant;
        if (variant == 0) {
            // Variant 0: Can only see current square. No memory.
            ignorant = [0,1,3,4];
        }

        else if (variant == 1) {
            // Variant 1: Can see current square, and remembers previous square.
            if (this.positions.length > 1) {
                var prev = this.movements[this.positions.length - 1];
                if (prev == 'U') {
                    // Reveal 'D'
                    ignorant = [0,1,3];
                }
                else if (prev == 'L') {
                    // Reveal 'R'
                    ignorant = [0,1,4];
                }
                else if (prev == 'S') {
                    // Reveal only the current position.
                    ignorant = [0,1,3,4];
                }
                else if (prev == 'R') {
                    // Reveal 'L'
                    ignorant = [0,3,4];
                }
                else if (prev == 'D') {
                    // Reveal 'U'
                    ignorant = [1,3,4];
                }
            }
            else {
                ignorant = [0,1,3,4];
            }
        }

        else if (variant == 2) {
            // Variant 2: Can see current square and square in forward direction relative to previous move.
            if (this.positions.length > 1) {
                var prev = this.movements[this.positions.length - 1];
                if (prev == 'U') {
                    // Reveal 'U'
                    ignorant = [1,3,4];
                }
                else if (prev == 'L') {
                    // Reveal 'L'
                    ignorant = [0,3,4];
                }
                else if (prev == 'S') {
                    // Reveal only the current position.
                    ignorant = [0,1,3,4];
                }
                else if (prev == 'R') {
                    // Reveal 'R'
                    ignorant = [0,1,4];
                }
                else if (prev == 'D') {
                    // Reveal 'D'
                    ignorant = [0,1,3];
                }
            }
            else {
                ignorant = [0,1,3,4];
            }
        }

        else if (variant == 3) {
            // Variant 3: Can see all nearest neighbor squares.
            ignorant = [];
        }

        for (idx = 0; idx < ignorant.length; ++idx) {
            // Make a copy (using jQuery) since we will modify it.
            squares[ignorant[idx]].cell = $.extend({}, squares[ignorant[idx]].cell);
            squares[ignorant[idx]].cell.ignorant = true;
        }

        return squares;
    };


    Nematode.prototype.setPosition = function(i, j) {
        // Get the starting point if none is provided.
        i = typeof i !== 'undefined' ? i : Math.floor(Math.random() * this.environment.landscape.nRows);
        j = typeof j !== 'undefined' ? j : Math.floor(Math.random() * this.environment.landscape.nCols);

        var coords = this.environment.getMatrixCoordinates(i, j);

        // Make sure we store the modded coordinates.
        this.positions = [coords];
        // There is no movement that led to the starting point.
        this.movements = [undefined];
    }

    Nematode.prototype.setVariant = function(variant) {
        this.variant = variant;
        this.draw();
    }

    Nematode.prototype.draw = function() {
        var position = this.positions[this.positions.length - 1];
        var squares = this.getSquares(position.i, position.j);

        var attr = this.environment.landscape.attr;
        var opacity = 1;
        var stroke = "gray";

        var nRows = 3;
        var nCols = 3;

        // Set the color of each box by the value of the landscape.
        var colormap = this.environment.colormap
        var colorFunc = function(d) {
            // Note, setting the fill to none seems to hide the tooltip from title.
            return colormap(d.cell[attr]);
        }

        // Add a second class "ignorant" positions, when appropriate.
        var classFunc = function(d) {
            var cls = "cell";
            if (typeof d.cell.ignorant !== 'undefined') {
                cls = cls + ' ignorant';
            }
            return cls;
        }

        // Do not show value of landscape for ignorant positions.
        var titleFunc = function(d) {
            if (typeof d.cell.ignorant == 'undefined') {
                return d.cell[attr].toFixed(3);
            }
            else {
                return "";
            }
        }

        var midpoint = this.environment.landscape.min + (this.environment.landscape.max - this.environment.landscape.min) / 2;
        var fontColor = function(d) {
            if (d.cell[attr] > midpoint) {
                return "white";
            }
            else {
                return "black";
            }
        }

        // This represents pixel space.
        var j_to_u = d3.scale.ordinal().rangeBands([0, this.width]),
            i_to_v = d3.scale.ordinal().rangeBands([0, this.height]);
        // Map the i:j matrix coordinates to pixel coordinates v:u.
        j_to_u.domain(d3.range(nCols));
        i_to_v.domain(d3.range(nRows));

        // Margins around the landscape
        var margin = {top: 10, right: 10, bottom: 10, left: 10};

        d3.select(this.elementID).on("mousedown", function(){
            d3.event.preventDefault();
        });

        // Remove everything from the element.
        $(this.elementID).empty();

        // Create the SVG element with the proper dimensions.
        var svg = d3.select(this.elementID).append("svg")
            .attr("width", this.width + margin.left + margin.right)
            .attr("height", this.height + margin.top + margin.bottom)
            .style("margin-left", -margin.left + "px")
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // Disable for now.
        /*svg.append("rect")
            .attr("class", "background")
            .attr("width", this.width)
            .attr("height", this.height);
        */

        // Keep a reference to the nematode instance.
        var that = this;

        var g = svg.append("g");

        var gg = g.selectAll("rect").data(squares).enter().append("g");

        gg.append("rect")
            .attr("class", classFunc)
            .attr("x", function(d) { return j_to_u(d.j); })
            .attr("y", function(d) { return i_to_v(d.i); })
            .attr("width", j_to_u.rangeBand())
            .attr("height", i_to_v.rangeBand())
            .style("fill-opacity", opacity)
            .style("fill", colorFunc)
            .style("stroke", stroke)

        // Show value
        gg.append("text")
            .attr("x", function(d) {
                if (d.i == 1 && d.j == 1) {
                    return j_to_u(d.j) + j_to_u.rangeBand() / 10;
                }
                else {
                    return "";
                }
            })
            .attr("y", function(d) {
                if (d.i == 1 && d.j == 1) {
                        return i_to_v(d.i) + i_to_v.rangeBand() / 10;
                    }
                    else {
                        return "";
                    }
            })
            .attr("fill", fontColor)
            .text(titleFunc);


        // Get the desired angle.
        var lastpos = that.movements[that.movements.length - 1];
        var angle = 0;
        if (typeof lastpos !== 'undefined') {
            if (lastpos == "L") {
                angle = -90;
            }
            else if (lastpos == "R") {
                angle = 90;
            }
            else if (lastpos == "D") {
                angle = 180;
            }
            else if (lastpos == "S") {
                // Grab the position from two times ago.
                lastpos = that.movements[that.movements.length - 2];
                if (typeof lastpos !== 'undefined') {
                    if (lastpos == "L") {
                        angle = -90;
                    }
                    else if (lastpos == "R") {
                        angle = 90;
                    }
                    else if (lastpos == "D") {
                        angle = 180;
                    }
                }
            }
        }

        svg.append("g")
            .attr("transform", "rotate(" + angle + " " + (j_to_u(1) + j_to_u.rangeBand()/2) + " " + (i_to_v(1) + i_to_v.rangeBand()/2) + ")")
            .attr("class", "avatar")
            .append("image")
            .attr("x", j_to_u(1) + .1 * j_to_u.rangeBand())
            .attr("y", i_to_v(1) + .1 * i_to_v.rangeBand())
            .attr("xlink:href", "nematode.png")
            .attr("width", .8 * j_to_u.rangeBand() )
            .attr("height", .8 * i_to_v.rangeBand() );

        // Now do it again for the clicks.

        var g = svg.append("g");

        g.selectAll("rect")
            .data(squares)
            .enter().append("rect")
            .attr("class", "clickable")
            .attr("x", function(d) { return j_to_u(d.j); })
            .attr("y", function(d) { return i_to_v(d.i); })
            .attr("width", j_to_u.rangeBand())
            .attr("height", i_to_v.rangeBand())
            .style("fill-opacity", 0)
            .on("mouseover", function(p) {
                that.environment.setPositionText(p.cell);
            })
            .on("click", function(p) {
                if (p.i == 1 && p.j == 1) {
                    // Disable the ability to "stay" in place.
                    return
                }
                that.positions.push({i:p.cell.i, j:p.cell.j});
                that.movements.push(p.movement);
                // This is a bit of a hack. Because ignorant cells have
                // "fill: white !important;" we cannot see the transition.
                // So we have to turn off the ignorant class. No matter
                // it will briefly show the true color (fine since they move
                // there) and will be remade ignorant on the redraw.
                d3.select(this)
                    .classed("ignorant", false)
                    .transition().duration(25)
                    .style("fill-opacity", 1).style("fill", "black")
                    .each("end", function() {
                    //.each(function() {
                        // Since draw() empties the element, it doesn't
                        // matter that the cell is now black.
                        that.draw();
                    });

                // Call user registered click callbacks.
                // This is necessary since we redraw the nematode cells
                // on each click---so the user binding on any particular
                // cell will be removed once the nematode is redrawn.
                for (var i = 0; i < that.clickCallbacks.length; i++) {
                    // Call the callback, passing the nematode as "this".
                    that.clickCallbacks[i].call(that);
                }
                that.environment.updatePositionMarker(that, p.cell);
            })
            .append("title").text(titleFunc);

    }

    // API
    context.createGaussian = createGaussian;
    context.createLandscape = createLandscape;
    context.Environment = Environment;
    context.Nematode = Nematode;

})(nematode);
