/********************************************************************
* Copyright (c) 1987 InterSoft Co.  All Rights Reserved
* THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF InterSoft Co.
* The copyright notice above does not evidence any
* actual or intended publication of such source code.
*
* $Id: rgenrut.cc,v 1.2 1996/07/03 19:09:38 eduardoc Exp $
*
* DESCRIPTION
* General routines for the RGEN utility. 
*********************************************************************/

#include <ideafix.h>
#include <cfix.h>
#include <ideafix/priv/gndefs.h>
#include <ideafix/priv/opers.h>
#include <ideafix/priv/dbdefs.h>
#include <ideafix/priv/reprep.h>
#include <ideafix/priv/repexpr.h>
#include "rgen.h"
#include "rgenpar.h"

#include <ifound/parray.h>

#define ENV_VAR_CHAR	'$'

// Variables taken from other modules
extern char *rtystr[];
extern char *sccsid;
extern bool language;

// Public variables defined in this module

ReportRep *rep = NULL;

static FILE *out = NULL;				// output file pointer
static schema _far schd_table[MAX_SCHEMAS];	// Open schemas dbtable
static bool	prUndecl;					// Flag to print undeclared flds

// ++ Prototypes ++

static void printUndeclFlds(void);
static int writeLine(FILE *rhed, int compare, char *buff);
static void inheritAllExprs(RpFieldRep *rpfld, struct s_field *dbfld);

// -- Prototypes --


extern FILE *yyin;

// Initialize variables used during compilation.
void initCompile(FILE *f, char *module, bool gen_f)
{
	if (rep != NULL) {
		delete rep;
	}

	String mName = String(module).baseName();
	rep = new ReportRep();
	rep->name(mName);

	prUndecl = gen_f;
	out	= f;
	rgenSetError(false);
	rgenLineNo(1);
	language = false;
	yyrestart(yyin);
}

// Print a list of undeclared fields
static void printUndeclFlds()
{
	RpZoneObject *zobj;
	RpZoneExpr *ze;
	RpZoneRep *zone;
	Int i, j;
	Int nobjs;
	Int nz = rep->nZones();
	for (i = 0; i < nz; ++i) {
		zone = rep->zone(i);
		assert(zone != NULL);
		nobjs = zone->nObjs();
		for (j = 0; j < nobjs; ++j) {
			zobj = zone->object(j);
			assert(zobj != NULL);
			ze = zobj->getRpZoneExpr();
			if (ze != NULL && ze->type() == ERR) {
				String eDescr = ze->descr();
				rgen_error("UNDECL_FLD", toCharPtr(eDescr));
			}
		}
	}
}

static void finishExpressions()
{
	RpZoneObject *zobj;
	RpZoneExpr *ze;
	RpZoneRep *zone;
	Int i, j;
	Int nobjs;
	Int nz = rep->nZones();

	// Create the necessary RpAccumulator's
	for (i = 0; i < nz; ++i) {
		zone = rep->zone(i);
		assert(zone != NULL);
		if (!zone->ifExpr().resolveFields())
			rgen_error("EXPR_SYNTAX_ERR", "if",
					toCharPtr(zone->ifExpr().getExpr()));
		nobjs = zone->nObjs();
		for (j = 0; j < nobjs; ++j) {
			zobj = zone->object(j);
			assert(zobj != NULL);
			ze = zobj->getRpZoneExpr();
			if (ze != NULL && !ze->expr().resolveFields()) {
				String tmpExpr = ze->expr().getExpr();
				rgen_error("EXPR_SYNTAX_ERR", "zone argument",
						toCharPtr(tmpExpr));
			}
		}
	}
}

void setFieldType(RpFieldRep *fr, Int ty, Int l, Int nd)
{
	if (fr == NULL) {
		rgen_error("INVALID_TY_SPEC");
		return;
	}

	fr->type(ty);
	fr->length(l);
	fr->nDec(nd);
}

void setFieldTypeChecking(RpFieldRep *fr, Int ty, Int l, Int nd)
{
	if (fr == NULL) {
		rgen_error("INVALID_TY_SPEC");
		return;
	}

	RpZoneObject *zobj;
	RpZoneExpr *ze;
	RpZoneRep *zone;
	Int i, j;
	Int nobjs;
	Int nz = rep->nZones();

	/*
		Check types for all expressions that refer to this field
		and issue a warning when a mismatch is found.
	*/
	for (i = 0; i < nz; ++i) {
		zone = rep->zone(i);
		assert(zone != NULL);
		nobjs = zone->nObjs();
		for (j = 0; j < nobjs; ++j) {
			zobj = zone->object(j);
			assert(zobj != NULL);
			ze = zobj->getRpZoneExpr();
			if (ze != NULL && ze->type() != ty && ze->field() == fr) {
				String t1 = typeName(ty);
				String t2 = typeName(ze->type());
				rgen_warn("DIFF_TYPES", toCharPtr(fr->name()),
						toCharPtr(t1), toCharPtr(t2));
			}
		}
	}

	setFieldType(fr, ty, l, nd);
}

// Final check.  Performed after compilation.
int finalCheck(void)
{
	Int flength;

	// Obtain the max number of lines occupied by AFTER PAGE zones
	flength = rep->fLengthExpr().haveEnvVars() ? 1000 : rep->fLength();
	flength -= rep->botMargExpr().haveEnvVars() ? 0 : rep->botMarg();
	flength -= rep->topMargExpr().haveEnvVars() ? 0 : rep->topMarg();

	Int i;
	RpZoneRep *z;
	for (i = rep->nZones() - 1; i > 0; i--) {
		z = rep->zone(i);
		if (z->condWhen() & Report::after && 
				z->condType() & Report::page) {
			rep->maxLinesAfter(rep->maxLinesAfter() + z->nLines());
			if (z->atLine() != ERR &&
					flength - rep->maxLinesAfter() >= z->atLine())
				rep->maxLinesAfter(flength - z->atLine() + 1);
		}
	}

	// If marked, print list of undeclared fields
	if (prUndecl)
		printUndeclFlds();

	finishExpressions();
	/* 
		Set the input order.  For historical reasons, a flag signals
		if order is defined.  Nowadays, we use a default, so the flag
		is always true (but put a message to inform we use default).
	*/
	Int nf = rep->nFields();
	assert(rep->nOrderFlds() <= nf);

	if (rep->nOrderFlds() != nf) {
		rgen_warn("DEFAULT_ORDER");
		rep->clearOrderFlds();
		for (i = 0; i < nf; ++i) {
			rep->nextField(rep->field(i));
		}
	}

	// Return the Error state
	return rgenErrorState() ? ERR : OK;
}

/*************** Write the header file ***************************/

// Write a line or compare it on file rhed.
static int writeLine(FILE *rhed, int compare, char *buff)
{
	char buff2[256];
	if (compare == RPH_WRITE)
		fputs(buff, rhed);
	else if (fgets(buff2, sizeof(buff2), rhed) == NULL ||
			str_ne(buff, buff2))
		return ERR;
	return compare == RPH_WRITE ? ferror(rhed) : OK;
}

/*
 * writeHeader: Write the header file for this report.
 * -> Better call it before converting pointers to offset !!!.
 * IMPORTANT: Print only one line in each call to writeLine. Use
 *            EXACTLY ONE \N AT THE END of each line format.)
 *
 * If compare is RPH_COMPARE the header is not writen, only compared
 * with an existent header whose descriptor is fhed. In this case 
 * the return value is ERR if they are different.
 *
 * If compare is RPH_WRITE, the header is written to disk.
 */

#define writeOrCompare()  \
	if (writeLine(rhed, compare, buff) == ERR) return ERR

Int writeHeader(FILE *rhed, int compare)
{
	char buff[256];
	long chksum = 0;

	/* 
		Dump the field names				
		Skip the virtual fields ball breaker!
	*/
	sprintf(buff, "/* Field names	*/\n");
	writeOrCompare();

	Int nf = rep->nFields();
	Int i;
	for (i = 0; i < nf; ++i) {
		RpFieldRep *f = rep->field(i);
		chksum += (i + 1) * (f->type() + 1);
		chksum &= 0xffff;
		String fName = f->name().toUpper();
		String tName = typeName(f->type());
		sprintf(buff, "# define %-15s ((rpfield) %3ld) 	/* %s */\n",
				toCharPtr(fName), i, toCharPtr(tName));
		writeOrCompare();
	}

	// Dump the checksum
	sprintf(buff, "/* Report Checksum	*/\n");
	writeOrCompare();
	{
		Int j;
		String mName = rep->name().toUpper();

		// Replace non-alphanumeric characters with underscores
		for (j = 0; j < mName.length(); ++j)
			if (!isalnum(mName[j]))
				mName.setChar('_', j);

		sprintf(buff, "# define RP_%s_CHKSUM ((long) 0x%04lx)\n",
					toCharPtr(mName), chksum);
	}
	writeOrCompare();

	// Dump the zone names

	sprintf(buff, "/* Zone names	*/\n");
	writeOrCompare();

	Int nz = rep->nZones();
	for (i = 0; i < nz; ++i) {
		String zName = rep->zone(i)->name().toUpper();
		sprintf(buff, "# define %-15s ((int) %3d)\n", 
				toCharPtr(zName), i);
		writeOrCompare();
	}
	return OK;
}

/******************** I/O HANDLING **************************/

bool setSchemaDescriptor(Int n, schema scd)
{
	if (n > MAX_SCHEMAS)
		return false;
	schd_table[n] = scd;
	return true;
}

/*
	Return the dbfield descriptor. The schema position in the report
	schema list is added, or'ed in the MSB byte of the dbfield.
*/
dbfield mkField(Int schnum, const char *tab_name, const char *fld_name)
{
	dbtable tab; dbfield fld;
	schema sch = schd_table[schnum];

	// if sch descriptor is 0 (ERR), shut up Error messages
	if (sch == ERR)
		return (dbfield)0;
	if ((tab = FindDbTable(sch, (char *) tab_name)) == ERR)
		return ERR;
	if ((fld = FindDbField(tab, (char *) fld_name)) == ERR)
		return ERR;

	return fld | (schnum << 24);
}

/*
	Take the attributes of a dbfield that are inherited from
	database fields.
		- Field types are checked to assure they are compatible
		- Also the number of decimal places is checked
		- The report dbfield inherites the mask.
*/
void resolveHeritage(RpFieldRep *rpfld)
{
	struct s_field *dbfld = _GetFldPtr(rpfld->dbField());

	// Check that types are compatible
	if (dbfld->d.f_type == TY_BOOL || dbfld->d.f_type == TY_FLOAT) {
		if ((dbfld->d.f_type == TY_BOOL && rpfld->type() != TY_BOOL) ||
				(dbfld->d.f_type == TY_FLOAT &&
				rpfld->type() != TY_FLOAT)) {
			rgen_error("INCP_DBTYPE");
			return;
		}
	} else if (isnumeric(dbfld->d.f_itype)) {
		if (rpfld->type() != TY_FLOAT && rpfld->type() != TY_NUMERIC
				&& rpfld->type() != TY_STRING) {
			rgen_error("INCP_DBTYPE");
			return;
		}
	} else if (dbfld->d.f_type != rpfld->type()) {
		rgen_error("INCP_DBTYPE");
		return;
	}

	inheritAllExprs(rpfld, dbfld);
}

static void inheritAllExprs(RpFieldRep *rpfld, struct s_field *dbfld)
{
	Int nz = rep->nZones();
	Int i;
	for (i = 0; i < nz; ++i) {
		RpZoneRep *zone = rep->zone(i);
		Int nobjs = zone->nObjs();
		Int j;
		for (j = 0; j < nobjs; ++j) {
			RpZoneObject *zobj = zone->object(j);
			assert(zobj != NULL);
			RpZoneExpr *zexpr = zobj->getRpZoneExpr();
			if (zexpr != NULL && zexpr->field() == rpfld) {

				// Inherit the type
				setFieldType(rpfld, dbfld->d.f_type, dbfld->d.len,
						dbfld->d.ndec);

				// Inherit the check digit flag
				if (dbfld->d.flags & F_CDIGIT &&
						zexpr->checkDigit() == RP_CDIGIT_UNDEF)
					zexpr->checkDigit(RP_CDIGIT);
				
				// Inherit the check digit w/dash separator flag
				if (dbfld->d.flags & F_CDIGIT_DASH &&
						zexpr->checkDigit() == RP_CDIGIT_UNDEF)
					zexpr->checkDigit(RP_CDIGIT_DASH);

				// Inherit the check digit w/slash separator flag
				if (dbfld->d.flags & F_CDIGIT_SLASH &&
						zexpr->checkDigit() == RP_CDIGIT_UNDEF)
					zexpr->checkDigit(RP_CDIGIT_SLASH);

				// Inherit the mask from data base
				char *mask = dbfld->d.mask.strval;
				if (mask && mask[0] &&
						zexpr->maskExpr().getExpr() == NULL_STRING) {
					if (zexpr->type() != TY_STRING) {
						rgen_error("MASK_INCP");
					} else {
						String nMask = String("\"") + String(mask) + String("\"");
						if (nMask[0] == ENV_VAR_CODE)
							nMask.setChar(ENV_VAR_CHAR, 0);
						zexpr->maskExpr().parse(nMask);
					}
				}
			}
		}
	}
}

Int writeRpo()
{
	rewind(out);
	assert(rep != NULL);
	rep->store(out);
	return ferror(out) ? ERR : OK;
}

