/********************************************************************
* Copyright (c) 1987 InterSoft Co.  All Rights Reserved
* THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF InterSoft Co.
* The copyright notice above does not evidence any
* actual or intended publication of such source code.
*
* $Id: rgen.h,v 1.1.1.1 1996/04/16 18:50:46 gustavof Exp $
*
* DESCRIPTION
* RGEN utility general purpose header. 
*
* Files that must be included before this:
* ----------------------------------------
* rpdefs.h
*********************************************************************/

#include <ifound/libinfo.h>

/* +++ CONFIG +++ */
#define MAX_FIELDS 		256
#define MAX_ACCUMS 		256
#define MAX_ZONES 		128
#define MAX_VAL_LEN		80
#define RP_VALTAB_SIZE 	0x7000
#define MAX_SYMBOLS     64
#define MAX_SCHEMAS     4
#define MAXSTRLST       2048
#define MAX_FEXT		4
/* --- CONFIG --- */


/* Constants				*/
#define RPH_COMPARE		0
#define RPH_WRITE		1
#define FILE_SPEC_LEN   (MAX_FNAME+MAX_FEXT+1)
#define FILE_FULL_LEN	128

#define UNDEF_FLD		(itype) 0xFF /* To signal that a field 
										internal type unknown yet	*/

/*
 * This nodes are used to build a list with the formats associated
 * with a zone. When the node is allocated, space for the string
 * is made, and it is placed in text.
 */
struct fld_data {
	Int type;
	short length;
	unsigned	has_sign	:1,
				comma		:1,
				doRound		:1;
	short ndec;
	short nlines;
	Int	chk_digit;
	struct fld_data *next;
	char text[1];
};

/* ++ Prototypes ++ */

void yyrestart(FILE *inFile);
int rgenpar_lex();
int finalCheck();
char *getZoneText();
Int getTextNLines();
Int rgenLineNo(void);
void rgenLineNo(Int n);
void rgen_lerr(const char *err, int line, ...);
void rgen_error(const char *err, ...);
void rgen_warn(const char *warn, ...);
void beginExpression(void);
bool setSchemaDescriptor(Int n, schema scd);
void resolveHeritage(RpFieldRep *ze);
dbfield mkField(Int formSch, const char *tabName, const char *fldName);
char *mkEnvVar(char *s);
void setWarnings(bool f);
char *_rgenErrMsg(const char *msg);
char *_rgenWarnMsg(const char *msg);
void rgenSetFile(char *s);
void rgenSetError(bool val);
bool rgenErrorState(void);
void initCompile(FILE *f, char *module, bool gen_f);
int rgenpar_parse(void);
Int writeHeader(FILE *fhed, int cmp);
Int writeRpo(void);
void setFieldTypeChecking(RpFieldRep *fr, Int ty, Int l, Int nd);
void setFieldType(RpFieldRep *fr, Int ty, Int l, Int nd);

/* -- Prototypes -- */
