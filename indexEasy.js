
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
    var xPixelsGlobal = 300;
    var yPixelsGlobal = 300;
    var xPixelsLocal = 300;
    var yPixelsLocal = 300;

    // Element which holds the position of the cursor.
    var positionID = "#position";

    // Here we create a landscape function.
    // It places a Gaussian of amplitude A at (x0, y0) using standard
    // deviations sigmax and sigmay (so covariance matrix is a diagonal).
    // Use as: createGaussian(A, x0, y0, sigmax, sigmay)
    var z1 = nematode.createGaussian(100, 0, 0, 1, 1);
    var func = function(x,y) {
        return 1 * z1(x,y);
    };

    // Now we create the landscape and draw it.
    var landscape = nematode.createLandscape(func, nRows, nCols, xMin, xMax, yMin, yMax);

    var e = new nematode.Environment(landscape, globalID, xPixelsGlobal, yPixelsGlobal, positionID);

    var defaultVariant = 0;
    $('#nematode_type').val(defaultVariant);
    var o = new nematode.Nematode(e, localID, xPixelsLocal, yPixelsLocal, defaultVariant);

    bindVariant("#nematode_type", o);
    //bindNumberOfMoves("#moves", o);
    bindMovesCountdown("#moves", "#energy", o, 20);


    ///////////////////////////////////


    /* Binds checkbox value to hide/show global container */
    $("#global_container").css("visibility", "visible");
    $('#showLandscapeCB').change(function () {
        var isChecked = $('#showLandscapeCB').prop("checked");
        if (isChecked) {
            $("#global_container").css("visibility", "visible");
        }
        else {
            $("#global_container").css("visibility", "hidden");
        }
    });

    /* Binds the value of the selected variant to the nematode */
    function bindVariant(elementID, nema) {
        $(elementID).change(function () {
            var val = $(nematode_type).val();
            nema.setVariant(val);
            nema.giveLife();
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

    function gameOver() {
        var msg = "Final Energy: "
        msg += o.energy.toFixed(0) + "\n\nPress OK to begin again."
        alert(msg);
        var data = {nematode: o.variant,
                    landscape: 'easy',
                    moves: o.positions.length - 1,
                    score: o.energy};
        // Send final energy to server...
        $.post("/nematode/db.php", data);
        o.giveLife();
    }

    function bindMovesCountdown(moveID, energyID, nema, maxMoves) {
        // Moves = Number of Positions - 1
        var updateMove = function() {
            var val = maxMoves - this.positions.length + 1;
            $(energyID).html(nema.energy.toFixed(0));
            $(moveID).html(val);
            if (val <= 0) {
                // Mark the nematode as dead, so that no more moves can occur.
                o.alive = false;
                setTimeout(gameOver, 500);
            }
        }
        nema.clickCallbacks.push(updateMove);
        $(moveID).html(maxMoves - nema.positions.length + 1);
        $(energyID).html(nema.energy.toFixed(0));

    }

});
