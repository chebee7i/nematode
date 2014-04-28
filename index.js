
// Everything in here is run when the document loads.

$(function () {

    // Parameters
    var nRows = 20;
    var nCols = 20;
    var xMin = -3;
    var xMax = 3;
    var yMin = -3;
    var yMax = 3;

    // Element which holds the global and local view.
    var globalID = "#global";
    var localID = "#local";

    // The desired size of the global and local views.
    var xPixelsGlobal = 400;
    var yPixelsGlobal = 400;
    var xPixelsLocal = 400;
    var yPixelsLocal = 400;

    // Element which holds the position of the cursor.
    var positionID = "#position";

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

    var e = new nematode.Environment(landscape, globalID, xPixelsGlobal, yPixelsGlobal, positionID);

    var defaultVariant = 0;
    var o = new nematode.Nematode(e, localID, xPixelsLocal, yPixelsLocal, defaultVariant);

    bindVariant("#nematode_type", o);
    bindNumberOfMoves("#moves", o);


    ///////////////////////////////////


    /* Binds the value of the selected variant to the nematode */
    function bindVariant(elementID, nema) {
        $(elementID).change(function () {
            var val = $(nematode_type).val();
            nema.setVariant(val);
        });
    }

    /* Make nematode moves update the move counter. */
    function bindNumberOfMoves(elementID, nema) {
        var updateMove = function() {
            $(elementID).html(this.positions.length-1);
        }
        nema.clickCallbacks.push(updateMove);
        $(elementID).html(nema.positions.length - 1);
    }

});
