<?php

/*
create table scores (
       id int not null auto_increment,
       nematode varchar(255) not null,
       landscape varchar(255) not null,
       moves int not null,
       score int not null,
       primary key (id)
);

 */

$dbhost = 'localhost:3306';
$dbname = 'nematode';
$dbuser = 'nematode';
$dbpass = 'nematode';

$conn = mysql_connect($dbhost, $dbuser, $dbpass);
if (!$conn) {
	die('Could not connect: ' . mysql_error());
}

$db = mysql_select_db($dbname);

$nematode = $_POST["nematode"];
$landscape = $_POST["landscape"];
$moves = $_POST["moves"];
$score = $_POST["score"];

mysql_query("INSERT INTO scores (nematode, landscape, moves, score) VALUES ('$nematode', $landscape, $moves, $score)");

mysql_close($link);

?>
