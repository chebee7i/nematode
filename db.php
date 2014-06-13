<?php

/* create table scores (
 *      id int not null auto_increment,
 *      nematode varchar(255) not null,
 *      moves int not null,
 *      score int not null,
 *      primary key (id)
 *  );
 */

$dbhost = 'localhost:3306';
$dbname = 'nematode';
$dbuser = 'nematode';
$dbpass = 'nematode';

$conn = mysql_connect($dbhost, $dbuser, $dbpass);
if (!$conn) {
	die('Could not connect: ' . mysql_error());
}

$db = mysql_select($dbname);
echo 'done';
mysql_close($link);

?>
