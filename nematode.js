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

    // This will be set by createLandscape
    context.landscape = undefined;

    /* Returns the an object suitable for context.drawSquares.
     *
     * This is a 3x3 grid of squares, with some set to have no color.
     * But for now, we only provide squares 1, 3, 4, 5, 7.
     *
     *    0 1 2
     *    3 4 5
     *    6 7 8
     *
     * We currently support 4 types of nemotodes.
     *
     */
    context.getNematodeSquares = function(type, i, j) {
        // These are squares 1,3,4,5,7.
        var squares = [
            {i: 0, j:1, cell: context.getSquare(i-1, j+0), stroke: 1},
            {i: 1, j:0, cell: context.getSquare(i+0, j-1), stroke: 1},
            {i: 1, j:1, cell: context.getSquare(i+0, j+0), stroke: 1},
            {i: 1, j:2, cell: context.getSquare(i+0, j+1), stroke: 1},
            {i: 2, j:1, cell: context.getSquare(i+1, j+0), stroke: 1},
        ];

        var idx;
        var nocolors = []

        if (type == 0) {
            // Type 0: Can only see current square. No memory.
            nocolors = [0,1,3,4];
        }

        else if (type == 1) {
            // Type 1: Can see current square, and remembers previous square.
            nocolors = [0,1,3,4];
        }

        else if (type == 2) {
            // Type 2: Can see current square and square in forward direction.
            nocolors = [1,3,4];
        }

        else if (type == 3) {
            // Type 3: Can see all nearest neighbor squares.
            nocolors = [];
        }

        for (idx = 0; idx < nocolors.length; ++idx) {
            // Make a copy (using jQuery) since we will modify it.
            squares[nocolors[idx]].cell = $.extend({}, squares[nocolors[idx]].cell);
            squares[nocolors[idx]].cell.nocolor = true;
        }

        return squares;
    };


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
     *    var z = context.createGaussian(10, 0, 0, 1, 1);
     *
     */
    context.createGaussian = function(A, x0, y0, sigmax, sigmay) {

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
     *    var z1 = context.createGaussian(10, 1, 0, 1, 1);
     *    var z2 = context.createGaussian(-10, 0, 1, 1, 1);
     *    var myfunc = function(x,y) {
     *        return z1(x,y) + z2(x,y);
     *    }
     *    var lscape = context.createLandscape(myfunc, 10, 10, -3, 3, -3, 3);
     *
     */
    context.createLandscape = function(func, nRows, nCols, xMin, xMax, yMin, yMax) {
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
                    m: j, n: nCols - i - 1, // grid
                };
            }
        }
        var lscape = {nRows: nRows, nCols: nCols,
                      min: minz, max: maxz,
                      matrix: arr};

        context.landscape = lscape;

        return lscape;
    }

    // Draw the landscape in elementID giving it a particular width/height.
    // infoID is where you want the position of the cursor to be displayed.
    context.drawLandscape = function(elementID, infoID, landscape, width, height) {

        /**
         The attribute from landscape that we use to color the squares.

         Here we also set up a colormap.
         **/
        var attr = "z";
        var attr_domain = [landscape.min, landscape.max];

        /** The goal here is to create mapping from z to colors **/
        var niceDomain = d3.scale.linear().domain(attr_domain).nice().domain();
        // This is a mapping from 11 categories to equally spaced regions in the domain.
        var linspace = d3.scale.linear().domain([0,11]).range(niceDomain);
        // These are the 11 samples of the domain.
        var polyDomain = d3.range(11).reverse().map(linspace);
        // This is map from the attr space to color space.
        var c = d3.scale.linear().domain(polyDomain).range(colorbrewer.RdBu[11]).clamp(true);

        // Save it for later use.
        context.colorScale = c;

        // The "matrix"
        var matrix = landscape.matrix;

        // Margins around the landscape
        var margin = {top: 10, right: 10, bottom: 10, left: 10};

        // Remove everything from the element.
        $(elementID).empty();

        // Create the SVG element with the proper dimensions.
        var svg = d3.select(elementID).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .style("margin-left", -margin.left + "px")
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var nRows = landscape.nRows,
            nCols = landscape.nCols;

        // This represents pixel space.
        var j_to_u = d3.scale.ordinal().rangeBands([0, width]),
            i_to_v = d3.scale.ordinal().rangeBands([0, height]);
        // Map the i:j matrix coordinates to pixel coordinates v:u.
        j_to_u.domain(d3.range(nCols));
        i_to_v.domain(d3.range(nRows));

        // Now we add the elements
        svg.append("rect")
            .attr("class", "background")
            .attr("width", width)
            .attr("height", height);

        // For each row in landscape, create a row.
        var row = svg.selectAll(".row")
            .data(matrix)
            .enter().append("g")
            .attr("class", "row")
            .attr("transform", function(d, i) { return "translate(0," + i_to_v(i) + ")"; })
            .each(rowHandler);

        // Add a line after each row.
        row.append("line")
            .attr("x2", width);

        // Now create columns. For now, this is basic. All we do is add a line.
        var column = svg.selectAll(".column")
            .data(d3.range(nCols))
            .enter().append("g")
            .attr("class", "column")
            .attr("transform", function(d, i) { return "translate(" + i_to_v(i) + ")rotate(-90)"; });

        // Add a line after each column.
        column.append("line")
            .attr("x1", -height);

        function rowHandler(row) {
            var cell = d3.select(this).selectAll(".cell")
            .data(row)
            .enter().append("rect")
            .attr("class", "cell")
            .attr("x", function(d, j) { return j_to_u(j); })
            .attr("width", j_to_u.rangeBand())
            .attr("height", i_to_v.rangeBand())
            .style("fill-opacity", 1)
            .style("fill", function(d) { return c(d[attr]); })
            .on("mouseover", function(p) {
                // p is the actual object from the data matrix.
                $(infoID).html("(" + p.m + ", " + p.n + ")");
            })
            .on("mouseout", function(p) {
            })
            .on("click", function(p) {
                var squares = context.getNematodeSquares(3, p.i, p.j);
                context.drawSquares("#local", squares, 200, 200, 3, 3);
            })
            // No tool tip when hovering over a square.
            .append("title").text(function (q,i) { return q[attr].toFixed(3); });
        }


    /**
        squares is a list of elements from the matrix of squares.
        Each square contains enough information to place it properly
        within a grid of shape (nRows, nCols).

        fill can be left unspecified and we use the same colors as the landscape.
        opacity is a number between 0 and 1, with 1 representing no transparency

    **/
    context.drawSquares = function(elementID, squares, width, height, nRows, nCols, fill, opacity) {

        var attr = "z";

        var colorFunc = function(d) {
            // Set d.cell.nocolor = 1 to turn off coloring.
            // Note, setting the fill to none seems to hide the tooltip from title. Bonus!
            return typeof d.cell.nocolor !== 'undefined' ? 'none' : context.colorScale(d.cell[attr]);
        }

        fill = typeof fill !== 'undefined' ? fill : colorFunc;
        opacity = typeof opacity != 'undefined' ? opacity : 1;


        // This represents pixel space.
        var j_to_u = d3.scale.ordinal().rangeBands([0, width]),
            i_to_v = d3.scale.ordinal().rangeBands([0, height]);
        // Map the i:j matrix coordinates to pixel coordinates v:u.
        j_to_u.domain(d3.range(nCols));
        i_to_v.domain(d3.range(nRows));

        // Margins around the landscape
        var margin = {top: 10, right: 10, bottom: 10, left: 10};

        // Remove everything from the element.
        $(elementID).empty();

        // Create the SVG element with the proper dimensions.
        var svg = d3.select(elementID).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .style("margin-left", -margin.left + "px")
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        /*svg.append("rect")
            .attr("class", "background")
            .attr("width", width)
            .attr("height", height);
        */

        var g = svg.append("g");

        g.selectAll("rect")
            .data(squares)
            .enter().append("rect")
            .attr("class", "cell")
            .attr("x", function(d) { return j_to_u(d.j); })
            .attr("y", function(d) { return i_to_v(d.i); })
            .attr("width", j_to_u.rangeBand())
            .attr("height", i_to_v.rangeBand())
            .style("fill-opacity", opacity)
            .style("fill", fill)
            .style("stroke", function(d) {
                return typeof d.stroke !== 'undefined' ? "gray" : 'undefined';
            })
            .on("mouseover", function(p) {
                // p is the actual object from the data matrix.
                $(infoID).html("(" + p.cell.m + ", " + p.cell.n + ") hi");
            })
            .on("mouseout", function(p) {
            })
            .on("click", function(p) {
                var squares = context.getNematodeSquares(3, p.cell.i, p.cell.j);
                context.drawSquares(elementID, squares, 200, 200, 3, 3);
            })
            .append("title").text(function (q,i) { return q.cell[attr].toFixed(3); });
        }

    }

    /* We need to wrap matrix coordinates so that we live on a torus. */
    context.getCoordinateFunc = function(i, j, nRows, nCols) {
        var func = function(i,j) {
            return {i: i % nRows, j: j % nCols};
        }
        return func;
    }

    /* Returns the square associated with matrix coordinate i,j.
       (i,j) will be remapped back onto the grid, if necessary.
    */
    context.getSquare = function(i,j) {
        var ii = i % context.landscape.nRows;
        if (ii < 0) {
            ii = context.landscape.nRows + ii;
        }
        var jj = j % context.landscape.nCols;
        if (jj < 0) {
            jj = context.landscape.nCols + jj;
        }
        return context.landscape.matrix[ii][jj];
    }


})(nematode);
