
// Everything in here is run when the document loads.

var data;

$(function () {

    // Parameters
    var nRows = 20;
    var nCols = 20;
    var xMin = -3;
    var xMax = 3;
    var yMin = -3;
    var yMax = 3;

    // Element which holds the global view.
    var globalID = "#global";
    var localID = "#local";

    // The desired size of the global view.
    var xPixels = 400;
    var yPixels = 400;

    // Element which holds the position of the cursor.
    var infoID = "#position";

    // Here we create a landscape function.
    // It places a Gaussian of amplitude A at (x0, y0) using standard
    // deviations sigmax and sigmay (so covariance matrix is a diagonal).
    // Use as: createGaussian(A, x0, y0, sigmax, sigmay)
    var z1 = nematode.createGaussian(30, 0, 0, 1, 1);
    var z2 = nematode.createGaussian(-20, -1, -1, .5, .5);
    var z3 = nematode.createGaussian(-20, 1, 1, .5, .5);
    var func = function(x,y) {
        return z1(x,y) + z2(x,y) + z3(x,y);
    };

    // Now we create the landscape and draw it.
    var landscape = nematode.createLandscape(func, nRows, nCols, xMin, xMax, yMin, yMax);
    nematode.drawLandscape(globalID, infoID, landscape, xPixels, yPixels);

    var squares = nematode.getNematodeSquares(3, 2, 4);
    nematode.drawSquares(localID, squares, 200, 200, 3, 3);

    // Make data available at console
    data = landscape;

});
