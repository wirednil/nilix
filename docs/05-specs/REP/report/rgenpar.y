%{
/********************************************************************
* Copyright (c) 1987 InterSoft Co.  All Rights Reserved
* THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF InterSoft Co.
* The copyright notice above does not evidence any
* actual or intended publication of such source code.
*
* $Id: rgenpar.y,v 1.7 2004/09/29 17:14:20 damianm Exp $
*
* DESCRIPTION
* Grammar description & actions for the RGEN report & field syntax.
*
* ROUTINE      |  PURPOSE
*--------------+---------------------------------------------------
* yyparse()     Compile zone, field def., report & field of reports
*********************************************************************/

#include <stdlib.h>

#include <ideafix.h>
#include <cfix.h>
#include <ideafix/priv/gndefs.h>
#include <ideafix/priv/dbdefs.h>
#include <ideafix/priv/reprep.h>
#include <ideafix/priv/repexpr.h>
#include "rgen.h"

// Variables taken from other modules
extern char *rtystr[];					// Var's and func's names
extern bool language;
extern Int maxCols;						// Calculated by the rgenlex.l
extern ReportRep *rep;					// Report header

// Global static variables
static RpZoneRep *currZone = NULL;		// Current zone
static RpZoneRep *groupZone = NULL;		// zone to group with
static RpZoneExpr *currExpr = NULL;		// Current zone expression
static RpFieldRep *currFldRep = NULL;	// Current field rep... may be
										// null if currExpr is not a field
static bool firstExprOption;			// Flag for expression option
static Int nExprs;						// Number of exprs inside zone
static Report::When last_cond = Report::always;

// Private functions

static void checkCond(Report::When cnd);
static void resetRgenParser(void);
static int rgenpar_error(char *s);
static bool constExpr(ReportExpr &rExpr, const String &exprStr,
		const String &attr);

%}

%union {
	int ival;
	char *strval;
	struct fld_data *pf_data;
	Int f_type;
};

%token <ival> T_USE T_LEFTMARG T_WIDTH T_TOPRINTER T_INPUT
%token <ival> T_MASK T_BEFORE T_AFTER T_IF T_FROM T_RESETACCUM
%token <ival> T_GROUP T_WITH T_LINE T_EJECT
%token <ival> T_REPORT T_PAGE T_BEGRPDEF T_BEGFLDDEC
%token <ival> T_FLENGTH T_BOTMARG T_TOPMARG T_NULL T_ZEROS
%token <ival> T_OUTPUT T_TO T_TOPIPE T_NO T_FORMFEED T_TOTERMINAL T_PRINT
%token <ival> T_FROMTERMINAL T_FROMPIPE
%token <ival> T_TOSTDOUT T_AT T_CHECK T_DIGIT T_DECIMALS T_FILL
%token <ival> T_NUM T_FLOAT T_BOOL T_DATE T_TIME T_CHAR
%token <strval> T_STRING T_ID T_NUMBER T_EXPR
%token <f_type> T_LANGUAGE
%token <pf_data> T_FIELD

%type <strval> fldname
%type <strval> optstring expression
%type <ival> check
%type <ival> zone_decl

%%
rp			: zdefs rpdefs flddecs
			{ int fchk = finalCheck(); resetRgenParser(); return fchk; }
			| zdefs rpdefs
			{ int fchk = finalCheck(); resetRgenParser(); return fchk; }
			| zdefs flddecs
			{ int fchk = finalCheck(); resetRgenParser(); return fchk; }
			;
								
zdefs		: zdstatement
			| zdefs zdstatement
			| error '\n'				
			;

zdstatement	: zone_decl zone_opts '\n' fdefs
			{
				// Check if number of fields agree
				if ((short) currZone->nExprs() > nExprs) {
					String zName = currZone->name();
					rgen_lerr("LESS_FLDS", $1, toCharPtr(zName));
				}

				// Assign values
				currZone->add(new RpZoneLabel(currZone, getZoneText()));
				currZone->nLines(currZone->nLines() +
						getTextNLines());
				currZone->needLines(currZone->nLines());
				if (groupZone != NULL) {
					// separated in two because of compiler bug
					Int nl = groupZone->needLines() + currZone->nLines();
					groupZone->needLines(nl);
				}
			}
			| zone_decl zone_opts '\n' 
			{
				// Check if number of fields agree
				if ((short) currZone->nExprs() > nExprs) {
					String zName = currZone->name();
					rgen_lerr("LESS_FLDS", $1, toCharPtr(zName));
				}

				// Assign values
				char *zt = getZoneText();
				if (zt != NULL && zt[0] != '\0')
					currZone->add(new RpZoneLabel(currZone, zt));
				currZone->nLines(getTextNLines());
				currZone->needLines(currZone->nLines());
				if (groupZone != NULL) {
					Int nl = groupZone->needLines() + currZone->nLines();
					groupZone->needLines(nl);
				}
			}
			;

zone_decl	: zone_name '(' expr_list ')'
			{
				nExprs = 0;
				groupZone = NULL;
				$$ = rgenLineNo();
			}
			| zone_name '(' bexpr ')'
			{
				nExprs = 0;
				groupZone = NULL;
				$$ = rgenLineNo();
			}
			;

zone_name	: T_ID
			{
				if (rep->zone($1) != NULL)
					rgen_error("ZONE_REDEF", $1);
				rep->add(currZone = new RpZoneRep(rep, $1));
			}
			;

expr_list	: expression
			{
				RpZoneExpr *ze = new RpZoneExpr(currZone, $1);
				currZone->add(ze);
			}
			| expression ':' T_ID
			{
				RpZoneExpr *ze = new RpZoneExpr(currZone, $1);
				if (!addAlias($3, ze))
					rgen_error("ALIAS_CONFLICT", $3);
				else
					currZone->add(ze);
			}
			| expr_list ',' expression
			{
				RpZoneExpr *ze = new RpZoneExpr(currZone, $3);
				currZone->add(ze);
			}
			| expr_list ',' expression ':' T_ID
			{
				RpZoneExpr *ze = new RpZoneExpr(currZone, $3);
				if (!addAlias($5, ze))
					rgen_error("ALIAS_CONFLICT", $5);
				else
					currZone->add(ze);
			}
			;

expression	: bexpr T_EXPR
			{ $$ = $2; }
			;

bexpr		: // Empty
			{ beginExpression(); }
			;

zone_opts	: // Empty
			| zone_opt
			| zone_opts ',' zone_opt 
			;

zone_opt	: condition
			| group
			| page
			| T_NO T_PRINT
			{ currZone->noPrint(true); }
			;

condition	: T_BEFORE when_cond
			{ 
				checkCond(Report::before);
				currZone->condWhen(Report::When(currZone->condWhen() |
						Report::before));
			}
            | T_BEFORE '(' cond_flds ')'
			{ 
				checkCond(Report::before);
				currZone->condWhen(Report::When(currZone->condWhen() |
						Report::before));
			}
			| T_AFTER when_cond
			{ 
				checkCond(Report::after);
				currZone->condWhen(Report::When(currZone->condWhen() |
						Report::after));
			}
			| T_AFTER '(' cond_flds ')'
			{ 
				checkCond(Report::after);  
				currZone->condWhen(Report::When(currZone->condWhen() |
						Report::after));
			}
			| T_AT T_LINE expression
			{
				ReportExpr rexpr(rep);
				constExpr(rexpr, $3, "at line");
				currZone->atLine(toInt(rexpr.eval()));
			}
			| T_IF expression
			{ 
				if (currZone->ifExpr().getExpr() != NULL_STRING) {
					rgen_error("COND_REDEF", "if");
				} else {
					currZone->ifExpr().parse($2);
					if (!currZone->ifExpr())
						rgen_error("EXPR_SYNTAX_ERR", "if", $2);
				}
			}
			| T_RESETACCUM
			{ 
				if (currZone->hasResetAccumulators()) {
					rgen_error("COND_REDEF", "resetAccum");
				}
				else if (currZone->ifExpr().getExpr() == NULL_STRING) {
					rgen_error("RESET_CONFLICT", "resetAccum");
				}
				else {
					currZone->setResetAccumulators();
				}
			}
			;

cond_flds	: when_cond
			| cond_flds ',' when_cond
			;

group		: T_GROUP T_WITH T_ID
			{
				RpZoneRep *z = rep->zone($3);

				if (z == NULL)
					rgen_error("UNDEF_ZONE", $3);
				else
					groupZone = z;
			}
			;

page		: T_EJECT
			{ currZone->eject(true); }
			| T_EJECT T_AFTER
			{ currZone->eject(true); }
			| T_EJECT T_BEFORE
			{
				currZone->eject(true);
				currZone->before(true);
			}
			;

when_cond	: T_REPORT
			{
				currZone->condType(Report::WhenType(currZone->condType() |
						Report::report));
			}
			| T_PAGE
			{
				currZone->condType(Report::WhenType(currZone->condType() |
						Report::page));
			}
			| T_ID
			{ 
				RpFieldRep *fld;

				if ((fld = rep->field($1)) == NULL)
					rgen_error("UNDEF_FLD", $1);
				else {
					currZone->condType(Report::WhenType(currZone->condType() |
							Report::field));
					currZone->addCondField(fld);
				}
			}
			;

fdefs		: fdef
			| fdefs fdef
			;

fdef 		: T_FIELD
			{
				RpZoneExpr *zexpr;

				// Check that field exists
				if ((zexpr = currZone->findExpr(nExprs)) == NULL) {
					String zName = currZone->name();
					rgen_error("BAD_NFLD", toCharPtr(zName));
				} else {
					zexpr->type($1->type);
					zexpr->nDec($1->ndec);
					zexpr->length($1->length);
					zexpr->doRound($1->doRound);
					zexpr->showSign($1->has_sign);
					zexpr->thousandSep($1->comma);
					zexpr->checkDigit($1->chk_digit);

					if ($1->text != NULL && $1->text[0] != '\0')
						currZone->insert(zexpr, new RpZoneLabel(currZone,
								$1->text));

					// Add the number of lines to the zone
					currZone->nLines(currZone->nLines() + $1->nlines);
					nExprs++;

					// set field type with expression's type 
					// (only the first expression)
					RpFieldRep *f = zexpr->field();
					if (f != NULL && f->type() == ERR) {
						f->type(zexpr->type());
						f->length(zexpr->length());
						f->nDec(zexpr->nDec());
					}
				}
			}
			;

rpdefs		: T_BEGRPDEF rpdstats
			{ }
			| T_BEGRPDEF
			{ }
			;

rpdstats	: rpdstat
			{ }
			| rpdstats rpdstat
			{ }
			;

rpdstat 	: T_USE schemas ';' 
			{ }
			| T_FORMFEED ';'
			{ rep->noFormFeed(false); }
			| T_NO T_FORMFEED ';'
			{ rep->noFormFeed(true); }
			| T_FLENGTH '=' expression ';'
			{
				constExpr(rep->fLengthExpr(), $3, "flength");
				if (!rep->fLengthExpr().haveEnvVars())
					rep->fLength(toInt(rep->fLengthExpr().eval()));
			}
			| T_BOTMARG '=' expression ';'
			{
				constExpr(rep->botMargExpr(), $3, "botmarg");
				if (!rep->botMargExpr().haveEnvVars())
					rep->botMarg(toInt(rep->botMargExpr().eval()));
			}
			| T_TOPMARG '=' expression ';'
			{
				constExpr(rep->topMargExpr(), $3, "topmarg");
				if (!rep->topMargExpr().haveEnvVars())
					rep->topMarg(toInt(rep->topMargExpr().eval()));
			}
			| T_LEFTMARG '=' expression ';'
			{
				constExpr(rep->leftMargExpr(), $3, "leftmarg");
				if (!rep->leftMargExpr().haveEnvVars())
					rep->leftMarg(toInt(rep->leftMargExpr().eval()));
			}
			| T_WIDTH '=' expression ';'
			{
				constExpr(rep->widthExpr(), $3, "width");
				if (!rep->widthExpr().haveEnvVars())
					rep->width(toInt(rep->widthExpr().eval()));
			}
			| T_LANGUAGE T_STRING ';'
			{
				StrToUpper($2);
				if (StrCmp($2, (char *)"C") == 0) 
					language = true; 
				else
					rgen_error("NONSUP_LANG", $2);
			}
			| T_OUTPUT T_TOPRINTER ';'
			{
				rep->outputTo(Report::io_printer);
				// maxCols: calculated by rgenlex
				rep->widthExpr().parse(toString(maxCols));
			}
			| T_OUTPUT T_TOPIPE expression ';'
			{
				constExpr(rep->outExpr(), $3, "output to pipe");
				rep->outputTo(Report::io_pipe);
				// maxCols: calculated by rgenlex
				rep->widthExpr().parse(toString(maxCols));
			}
			| T_OUTPUT T_TOTERMINAL ';'
			{
				rep->outputTo(Report::io_term);
				rep->noFormFeed(true);
				// maxCols: calculated by rgenlex
				rep->widthExpr().parse(toString(maxCols));
			}
			| T_OUTPUT T_TOSTDOUT ';'
			{
				rep->outputTo(Report::io_pipe);
				// maxCols: calculated by rgenlex
				rep->widthExpr().parse(toString(maxCols));
			}
			| T_OUTPUT T_TO expression ';'
			{
				constExpr(rep->outExpr(), $3, "output to");
				rep->outputTo(Report::io_file);
				// maxCols: calculated by rgenlex
				rep->widthExpr().parse(toString(maxCols));
			}
			| T_INPUT T_FROM expression ';'
			{
				constExpr(rep->inExpr(), $3, "input from");
				rep->inputFrom(Report::io_file);
			}
			| T_INPUT T_FROMPIPE expression ';'
			{
				constExpr(rep->inExpr(), $3, "input from pipe");
				rep->inputFrom(Report::io_file);
			}
			| T_INPUT T_FROMTERMINAL ';'
			{
				// This is the default
			}
			| error ';'				
			;

check		: T_NO T_CHECK
			{ $$ = false; }
			| T_CHECK
			{ $$ = true; }
			;

optstring	: T_STRING
			{ $$ = $1; }
			| // Empty
			{ $$ = NULL; }
			;

schemas		: T_ID
			{
				schema sch;

				if (rep->nSchemas() > 0)
					rgen_error("USE_REDEF");
				else {
					if ((sch = OpenSchema($1, IO_SYMBOLS)) == ERR)
						rgen_error("OPENS_ERROR", $1);
					else {
						rep->addSchema($1);
					}
					if (!setSchemaDescriptor(0, sch))
						rgen_error("MAX_SCHEMAS", MAX_SCHEMAS);
				}
			}
			| schemas ',' T_ID			
			{ 	
				schema sch;
				if ((sch = OpenSchema($3, IO_SYMBOLS)) == ERR)
					rgen_error("OPENS_ERROR", $3);
				else
					rep->addSchema($3);

				if (!setSchemaDescriptor(rep->nSchemas() - 1, sch))
					rgen_error("MAX_SCHEMAS", MAX_SCHEMAS);
			}
			;

flddecs		: begflddec fdecs
			| begflddec
			;

begflddec	: T_BEGFLDDEC				
			{
				nExprs = 0;
				firstExprOption = true;
			}
			;

fdecs		: flddec
			{ firstExprOption = true; }
			| fdecs flddec			
			{ firstExprOption = true; }
			| error ';'				
			;

flddec		: fldname ';'
			{ }
			| fldname ':' ';'
			{ }
			| fldname ':' fldopts ';'
			{ }
			;

fldname		: T_ID		
			{
				if ((currExpr = findExpr(rep, $1)) == NULL) {
					rgen_error("UNDEF_FLD", $1);
				} else {
					// Assign the input order
					currFldRep = currExpr->field();
					/*
						Only add it to the field order when it is not
						an alias.
					*/
					if (currFldRep != NULL && findAlias($1) == NULL) {
						if (rep->nextField(currFldRep) == ERR) {
							rgen_error("DUP_DECLAR", $1);
						}
					}
				}
			}
			;

fldopts		: fldopt
			{ firstExprOption = false; }
			| fldopts ',' fldopt 
			;

fldopt		: table_field
			{ 	
				if (!firstExprOption) 
					rgen_error("BAD_DBDECL"); 
				else if (currFldRep != NULL && currFldRep->dbField() != ERR)
					resolveHeritage(currFldRep);
			}
			| type_spec
			{
			}
			| T_NO T_MASK
			{
				// toDo: mark the expression in some way to signal
				// that we do NOT want it
				currExpr->maskExpr().parse(NULL_STRING);
			}
			| T_MASK expression
			{
				RpZoneExpr *zexpr;

				while ( (zexpr = rep->findField(currExpr->field()->name()))
						 != NULL ) {

					currExpr = zexpr;	 

					if (currExpr->type() != TY_STRING)
						rgen_error("MASK_INCP");
					else if (currExpr->maskExpr().getExpr() != NULL_STRING)
						rgen_error("MASK_REDEF");
					else {
						constExpr(currExpr->maskExpr(), $2, "mask");
					}
				}	
			}
			| check T_DIGIT optstring
			{
				if (currExpr->type() != TY_NUMERIC)
					rgen_error("CDIGIT_NUMONLY");
				else {
					if (!$1) {
						// no check digit
						currExpr->checkDigit(RP_NO_CDIGIT);
					} else {
						if ($3 == NULL) {
							// check digit
							currExpr->checkDigit(RP_CDIGIT);
						} else {
							// check digit "-"
							if (!strcmp($3, "-"))
								currExpr->checkDigit(RP_CDIGIT_DASH);
							else {
								/*
									Slash separator assumed when we
									do not recognize the separator.
									(check digit "/")
								*/
								currExpr->checkDigit(RP_CDIGIT_SLASH);
							}
						}
					}
				}
			}
			| T_DECIMALS T_NUMBER
			{
				Int ndec = atoi($2);
				if (!currExpr->doRound()) {
					rgen_error("DECS_INCP");
				} else if (ndec < 0 || ndec > 15 ||
						ndec + 2 > currExpr->length()) {
					rgen_error("NDEC_WRONG");
				}
				currExpr->nDec(ndec);
			}
			| T_NULL T_ZEROS
			{
			/*	RpZoneExpr *zexpr;

				while ( (zexpr = rep->findField(currExpr->field()->name()))
						 != NULL ) {

					currExpr = zexpr;	 */
					if (currExpr->type() != TY_NUMERIC && 
							currExpr->type() != TY_FLOAT)
						rgen_warn("NUM_ONLY");
					else 
						currExpr->nullZeros(true);
/*				} */
			}
			| T_FILL T_ZEROS
			{
				if (currExpr->type() != TY_NUMERIC &&
						currExpr->type() != TY_FLOAT)
					rgen_warn("NUM_ONLY");
				else
					currExpr->fillZeros(true);
			}
			;

type_spec	: T_NUM
			{ setFieldTypeChecking(currFldRep, TY_NUMERIC, 2, 0); }
			| T_NUM '(' T_NUMBER ')'
			{
				int l = atoi($3);
				if (l > 28)
					rgen_error("E_INV_DIGITS");
				setFieldTypeChecking(currFldRep, TY_NUMERIC, l, 0);
			}
			| T_NUM '(' T_NUMBER ',' T_NUMBER ')'
			{
				int l = atoi($3);
				int nd = atoi($5);
				if (l > 28)
					rgen_error("E_INV_DIGITS");
				if (nd >= l)
					rgen_error("E_INV_DECIMALS");
				setFieldTypeChecking(currFldRep, TY_NUMERIC, l, nd);
			}
			| T_CHAR
			{ setFieldTypeChecking(currFldRep, TY_STRING, 1, 0); }
			| T_CHAR '(' T_NUMBER ')'
			{
				int l = atoi($3);
				setFieldTypeChecking(currFldRep, TY_STRING, l, 0);
			}
			| T_DATE
			{ setFieldTypeChecking(currFldRep, TY_DATE, 8, 0); }
			| T_TIME
			{ setFieldTypeChecking(currFldRep, TY_TIME, 6, 0); }
			| T_FLOAT
			{ setFieldTypeChecking(currFldRep, TY_FLOAT, 17, 0); }
			| T_BOOL
			{ setFieldTypeChecking(currFldRep, TY_BOOL, 4, 0); }
			;

table_field : T_ID '.' T_ID '.' T_ID
			{
				Int sch;

				if ((sch = rep->indOfSchema($1)) == ERR)
					rgen_error("SCH_NODEF", $1);
				else {
					Int dbfld = mkField(sch, $3, $5);
					if (dbfld == ERR)
						rgen_error("BAD_FIELD", $1, $3, $5);
					if (currFldRep != NULL)
						currFldRep->dbField(dbfld);
				}
			}
			| T_ID '.' T_ID
			{
				String sName = rep->schemaName(0);
				Int dbfld = mkField(0, $1, $3);
				if (dbfld == ERR)
					rgen_error("BAD_FIELD", toCharPtr(sName), $1, $3);
				if (currFldRep != NULL)
					currFldRep->dbField(dbfld);
			}
			| T_ID '.' T_ID '.'
			{
				Int sch;

				if ((sch = rep->indOfSchema($1)) == ERR)
					rgen_error("SCH_NODEF", $1);	
				else {
					String fName = currExpr->descr();
					fName.fullTrim();
					Int dbfld = mkField(sch, $3, toCharPtr(fName));

					if (dbfld == ERR)
						rgen_error("BAD_FIELD", $1, $3, toCharPtr(fName));

					if (currFldRep != NULL)
						currFldRep->dbField(dbfld);
				}
			}
			| T_ID '.'
			{
				String sName = rep->schemaName(0);
				String fName = currExpr->descr();
				fName.fullTrim();
				Int dbfld = mkField(0, $1, toCharPtr(fName));
				if (dbfld == ERR)
					rgen_error("BAD_FIELD", toCharPtr(sName), $1,
							toCharPtr(fName));
				if (currFldRep != NULL)
					currFldRep->dbField(dbfld);
			}
			;

%%

static void resetRgenParser()
{
	currZone = NULL;
	groupZone = NULL;
	currExpr = NULL;
	firstExprOption = false;
	nExprs = 0;
	last_cond = Report::always;
	clearAliases();
}

static int rgenpar_error(char *s)
{
	rgen_error("SYNTAX");
	return ERR;
}

/*
	Check that conditions are in order: 
	before before ...... after after .....
*/

static void checkCond(Report::When cnd)
{
	// These don't care
	if (cnd == Report::always)
		return;

	// If not initialized, initialize
	if (last_cond == Report::always) {
		last_cond = cnd;
		return;
	}

	if (last_cond != cnd)
		if (cnd == Report::after)
			last_cond = cnd;
		else
			rgen_error("COND_ORDER");
}

static bool constExpr(ReportExpr &rExpr, const String &exprStr,
		const String &attr)
{
	rExpr.parse(exprStr);

	if (!rExpr) {
		rgen_error("EXPR_SYNTAX_ERR", toCharPtr(attr), toCharPtr(exprStr));
		return false;
	} else if (rExpr.haveLValue()) {
		rgen_error("NOT_CONSTANT", toCharPtr(attr), toCharPtr(exprStr));
		return false;
	}

	return true;
}
