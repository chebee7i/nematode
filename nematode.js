/* Javascript for Nematode Scavenger Hunt

Keep in mind that there are 4 (or 5) coordinate systems in play.

(a,b) in the landscape matrix are a "box" space. This is like a unitless
pixel value. Importantly, SVG uses a coordinate system where a increases
rightward, and b increases downward. The eventual pixel coordinates are the
box coordinates scaled by the div width and height. This is like a viewport
transformation in openGL. SVG calls these coordinates x and y. So this is
technically 2 coordinate systems.

There is (x,y) in real space. This is used to evaluate real functions
when specifying the landscape. We want x to increase rightward and y to
increase upward.

There is (i,j) in matrix space. This is used to define a discretized version
of the landscape. In this coordinate system, i increases downward, and j
increases rightward.

Finally, there is (alpha, beta) in grid space. Here, we want to look
similar to (x,y) in real space. So alpha increases rightward, beta upward.
And further, we put the origin at the bottom, left. Only the display to
users need to care about this space. The internal code only cares about
(a,b), (x,y), and (i,j)

*/

var nematode = {};
(function(context) {

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
     *    var lscape = context.createLandscape(10, 10, -3, 3, -3, 3, myfunc);
     *
     */
    context.createLandscape = function(nRows, nCols, xMin, xMax, yMin, yMax, func) {
        var arr = [];

        // i increases downward, but y increases upward, so we reverse.
        // This makes the 0th row correspond to the maximum y.
        var rows = d3.range(nRows).reverse();
        var cols = d3.range(nCols);
        // We still need to shift the evaluation point by half the range band.
        var xscale = d3.scale.ordinal().domain(cols).rangeBands([xMin, xMax]);
        var yscale = d3.scale.ordinal().domain(rows).rangeBands([yMin, yMax]);

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
                var x = xscale(j) + xscale.rangeBand() / 2;
                var y = yscale(i) + yscale.rangeBand() / 2;
                var z = func(x,y);
                if (z < minz) {
                    minz = z;
                }
                if (z > maxz) {
                    maxz = z;
                }
                // In here, x and y are box coordinates.
                arr[i][j] = {a: j, b: i, z: z, alpha: j, beta: nCols - i - 1};
            }
        }
        var lscape = {nRows: nRows, nCols: nCols,
                      min: minz, max: maxz,
                      matrix: arr};
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
        var niceDomain = d3.scale.linear().domain(attr_domain).nice().domain();
        // This is a mapping from 11 categories to equally spaced regions in the domain.
        var linspace = d3.scale.linear().domain([0,11]).range(niceDomain);
        // These are the 11 samples of the domain.
        var polyDomain = d3.range(11).reverse().map(linspace);
        // This is map from the attr space to color space.
        var c = d3.scale.linear().domain(polyDomain).range(colorbrewer.RdBu[11]).clamp(true);

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
        var x = d3.scale.ordinal().rangeBands([0, width]),
            y = d3.scale.ordinal().rangeBands([0, height]);
        // Map the rows/cols to pixel space y/x.
        x.domain(d3.range(nCols));
        y.domain(d3.range(nRows));

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
            .attr("transform", function(d, i) { return "translate(0," + y(i) + ")"; })
            .each(rowHandler);

        // Add a line after each row.
        row.append("line")
            .attr("x2", width);

        // Now create columns. For now, this is basic. All we do is add a line.
        var column = svg.selectAll(".column")
            .data(d3.range(nCols))
            .enter().append("g")
            .attr("class", "column")
            .attr("transform", function(d, i) { return "translate(" + x(i) + ")rotate(-90)"; });

        // Add a line after each column.
        column.append("line")
            .attr("x1", -height);

        function rowHandler(row) {
            var cell = d3.select(this).selectAll(".cell")
            .data(row)
            .enter().append("rect")
            .attr("class", "cell")
            // d.a is the number of columns over. We map this to pixels now.
            .attr("x", function(d) { return x(d.a); })
            .attr("width", x.rangeBand())
            .attr("height", y.rangeBand())
            .style("fill-opacity", 1)
            .style("fill", function(d) { return c(d[attr]); })
            .on("mouseover", mouseover)
            .on("mouseout", mouseout)
            // No tool tip when hovering over a square.
            .append("title").text(function (q,i) { return q[attr].toFixed(4); });
        }

        function mouseover(p) {
            // p is the actual object from the data matrix.

            $(infoID).html("(" + p.alpha + ", " + p.beta + ")");
        }

        function mouseout() {
        }

    }

})(nematode);
