/********************************************************************
* Copyright (c) 1987 InterSoft Co.  All Rights Reserved
* THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF InterSoft Co.
* The copyright notice above does not evidence any
* actual or intended publication of such source code.
*
* $Id: rgenconf.cc,v 1.1.1.1 1996/04/16 18:50:46 gustavof Exp $
*
* DESCRIPTION
* Configuration file for rgen utility
*********************************************************************/

#include <ideafix.h>
#include <cfix.h>
#include <ideafix/priv/opers.h>
#include <ideafix/priv/dbdefs.h>
// #include <ideafix/priv/fmdefs.h>

/*
 * Name of the functions
 */
char *rtystr[] = {
	"FIELD", 
	/* Functions */
	"SUM", "AVG", "COUNT", "MIN", "MAX", 
	"RUNSUM", "RUNAVG", "RUNCOUNT", "RUNMIN", "RUNMAX", "DAY", 
	"MONTH", "MONTHNAME", "YEAR", "DAYNAME", "DATE", 
	"TIME", 
	/* Variables */	
	"PAGE", "LINE", "MODULE", "TODAY", "HOUR", "FLENGTH", 
	"BOTMARG", "TOPMARG", "LEFTMARG", "WIDTH", 
	/* Constant */
	"CONST"
};
