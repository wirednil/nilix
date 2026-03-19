/********************************************************************
* Copyright (c) 1987 InterSoft Co.  All Rights Reserved
* THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF InterSoft Co.
* The copyright notice above does not evidence any
* actual or intended publication of such source code.
*
* $Id: rgenerr.cc,v 1.1.1.1 1996/04/16 18:50:46 gustavof Exp $
*
* DESCRIPTION
* Error handling routines for the RGEN utility.
*********************************************************************/

#include <ideafix.h>
#include <cfix.h>
#include <ifound/msgtable.h>
#include <ideafix/priv/opers.h>
#include <ideafix/priv/reprep.h>
#include <ideafix/priv/dbdefs.h>
#include "rgen.h"

/* +++ CONFIG +++ */
/* --- CONFIG --- */

/* Variables taken from other modules */

/* Public variables defined in this module */

// Global static variables
static bool error_flag;
static bool warnings;
static char *file;

// Set the current file name
void rgenSetFile(char *s)
{
	file = s;
}

// Display Error message on the stderr(screen).
void rgen_lerr(const char *err, int line, ...)
{
	va_list ap;
	char *arg1, *arg2, *arg3;

	va_start(ap, line);

	arg1 = va_arg(ap, char*);
	arg2 = va_arg(ap, char*);
	arg3 = va_arg(ap, char*);

	fprintf(stderr, "\"%s\", line %d, (%s): ", file, line, err);
	fprintf(stderr, _rgenErrMsg(err), arg1, arg2, arg3);
	fprintf(stderr, "\n");
	error_flag = true;
}

// Display Error message on the stderr(screen).
void rgen_error(const char *err, ...)
{
	va_list ap;
	char *arg1, *arg2, *arg3;

	va_start(ap, err);

	arg1 = va_arg(ap, char *);
	arg2 = va_arg(ap, char *);
	arg3 = va_arg(ap, char *);

	rgen_lerr(err, rgenLineNo(), arg1, arg2, arg3);
}

void rgen_warn(const char *warn, ...)
{
	va_list ap;
	char *arg1, *arg2, *arg3;

	va_start(ap, warn);

	arg1 = va_arg(ap, char *);
	arg2 = va_arg(ap, char *);
	arg3 = va_arg(ap, char *);

	if (!warnings)
		return;

	fprintf(stderr, "\"%s\", line %d, (Warning %s): ", 
			file, rgenLineNo(), warn);
	fprintf(stderr, _rgenWarnMsg(warn), arg1, arg2, arg3);
	fprintf(stderr, "\n");
}

void setWarnings(bool f)
{
	warnings = f;
}

bool rgenErrorState(void)
{
	return error_flag;
}

void rgenSetError(bool val)
{
	error_flag = val;
}

#define POOL_LEN	10
static String msgTab[POOL_LEN];
static Int offset = 0;

static String &getMsg(MsgTable *table, const String &message)
{
 	String &aux = msgTab[offset] = table->find(message);
	offset = (offset+1)%POOL_LEN;
	return aux;
}

char *_rgenErrMsg(const char *msg)
{
	static MsgTable *errMsg = NULL;
	if (errMsg == NULL)
		errMsg = new MsgTable("rgen", "err");
 	return (char *) toCharPtr(getMsg(errMsg, msg));
}

char *_rgenWarnMsg(const char *msg)
{
	static MsgTable *warnMsg = NULL;
	if (warnMsg == NULL)
		warnMsg = new MsgTable("rgen", "warn");
 	return (char *) toCharPtr(getMsg(warnMsg, msg));
}

