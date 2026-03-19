/********************************************************************
* Copyright (c) 1987 InterSoft Co.  All Rights Reserved
* THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF InterSoft Co.
* The copyright notice above does not evidence any
* actual or intended publication of such source code.
*
* $Id: rgen.cc,v 1.3 2004/09/29 17:14:24 damianm Exp $
*
* DESCRIPTION
* Main module of the RGEN utility.
*
* ROUTINE       |  PURPOSE
*---------------+---------------------------------------------------
*main			| Parse cmd. line & call rgen for each file.
*rgen           | Call the compiler for a file
*********************************************************************/

#include <unistd.h>

#include <ideafix.h>
#include <cfix.h>
#include <ideafix/priv/gndefs.h>
#include <ideafix/priv/opers.h>
#include <ideafix/priv/dbdefs.h>
#include <ideafix/priv/formrep.h>
#include <ideafix/priv/reprep.h>
#include "rgen.h"

/*++++++ CONFIG ++++++*/
/*------ CONFIG ------*/


/* Variables taken from other modules                               */
extern FILE *yyin;
extern char *sccsid; 

/* Private Functions												*/

/* ++ Prototypes ++ */

static int rgen(char *name, bool gen_h, bool gen_f, bool shfile);

/* -- Prototypes -- */

/* Global variables defined in this module							*/
char *pname;					/* Program name						*/
bool language;

/*
 * Usage: rgen [-b][-h][-w][-f] report
 *
 */
#ifdef IDEAWIN
dwcmd(Rgen, 3.11 94/01/25, APP_CLIENT)
#else
int main(int argc, char *argv[])
#endif
{
	int status; 		/* Program exit status				*/
	bool gen_h = false, /* Flag for generate header			*/
	     gen_f = false, /* Flag for print list of undecl	*/
		 gen_b = true,	/* Flag to print prog. version		*/
		 shfile;		/* Show file name while process     */

	/* Get the program name									*/
	pname = BaseName(argv[0]);
	
	/* Program start up */
#ifndef IDEAWIN
	Start(&argc, argv, PKG_DEVELOP);
#endif

	/* Parse Options 										*/
	while (--argc && **++argv == '-') {
		switch ((*argv)[1]) {
		case 'h' :
			gen_h = true;
			break;
		case 'w' :
			setWarnings(true);
			break;
		case 'b' :
			gen_b = false;
			break;
		case 'f' :
			gen_f = true;
			break;
		case 'D' :
			/* Uncomment the next line for debugging */
			/* { extern int rgenpar_debug; rgenpar_debug = 1; } */
			break;
		case 'C':
			{
				String li = LibraryInfo::libraries();
				fprintf(stderr, "%S\n", &li);
				Stop(0);
			}
		default  :
			DbBanner(pname);
			error(_rgenErrMsg("USAGE"), pname);
		}
	}

	/* Identify												*/
	if (gen_b)
		DbBanner(pname);

	/* Any argument left									*/
	if (!argc) 
		error(_rgenErrMsg("USAGE"), pname);

	/* Loop to process each file							*/
	for (shfile = argc > 1, status = 0; argc--; argv++){ 
		char fname[FILE_FULL_LEN], *name, *ext;

		name = BaseName(*argv);
		ext  = strrchr(name, '.');

		/* 
		 * Validate name length, extension, and build the complete
		 * file name on 'fname'
		 */
		if (ext) {
			if ((ext - name) > MAX_FNAME) {
				warning(_rgenErrMsg("LONG_FNAME"), pname, *argv);
				continue;
			} else if (str_ne(ext,".rp") && str_ne(ext,".RP")) {
				warning(_rgenErrMsg("ILL_SUFFIX"), pname, *argv);
				continue;
			}
			assert(strlen(*argv) < FILE_FULL_LEN);
			strcpy(fname, *argv);
		} else {
			if (strlen(name) > MAX_FNAME) {
				warning(_rgenErrMsg("LONG_FNAME"), pname, *argv);
				continue;
			}
			strcpy(fname, *argv);
			strcat(fname, ".rp");
		}

		/* Parse the file							*/
#ifdef IDEAWIN
		SetProcessWait();
#endif
		if (rgen(fname, gen_h, gen_f, shfile) == ERROR) status = 1;
	}
#ifdef IDEAWIN
    ResetProcessWait();
#endif
	Stop(status);
#ifndef IDEAWIN
	return 0;
#endif
}


/*
 * Open source and output files, and call the compile routines
 */
static int rgen(char *name, bool gen_h, bool gen_f, bool shfile)
{
	char ofname[FILE_SPEC_LEN];   /* output filename    		*/
	char hfname[FILE_SPEC_LEN];   /* header filename    		*/
	FILE *fhd, *out; 

	/* Try to open Files and compile 					*/
	if ((yyin = fopen(name, "r"))==NULL) {
		warning(_rgenErrMsg("OPEN"), pname, name);
		return ERR;
	}

	/* Build output and header name						*/
	/* The products are left in the current directory!! */
	sprintf(ofname, "%so",BaseName(name));
	sprintf(hfname, "%sh",BaseName(name));

	/* Open output file									*/
	if ((out = fopen(ofname, "wb"))==NULL) {
		warning(_rgenErrMsg("OPEN"), pname, ofname);
		fclose(yyin);
		return ERR;
	}

	/* Show file name & Initialize compiler stuff 		*/
	if (shfile)
		fprintf(stderr, "%s:\n", name);
	rgenSetFile(name);
	initCompile(out, name, gen_f);

	/* Compile & write data if compile OK 				*/
	if (rgenpar_parse() == OK) {

		/* First write the header file					*/
		if (gen_h || language) {
			bool dowrite = true;

			/* Verify if a header exists				*/
			if ((fhd = fopen(hfname, "r")) != NULL &&
				writeHeader(fhd, RPH_COMPARE) != ERR)
					dowrite = false;

			if (fhd != NULL) fclose(fhd);

			/* Write the file if neccesary				*/
			if (dowrite) {
				if ((fhd = fopen(hfname, "w")) == NULL ) {
					warning(_rgenErrMsg("OPEN"), hfname);
					rgenSetError(true);
				} else if (writeHeader(fhd, RPH_WRITE) == ERR) {
					warning(_rgenErrMsg("WRITE"), hfname);
					rgenSetError(true);
				}
				fclose(fhd);
			}
		}

		/* Write the compiled form						*/
		if (writeRpo() == ERR) {
			warning(_rgenErrMsg("WRITE"), hfname);
			rgenSetError(true);
		}
	}

	/* Close files										*/
	fclose(yyin);
	fclose(out);

	/* If Error, destroy the output files				*/
	if (rgenErrorState()) {
		unlink(ofname);
		if (gen_h)
			unlink(hfname);
	}
	return rgenErrorState() ? ERR : OK;
}
