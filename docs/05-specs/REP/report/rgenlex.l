%{
/********************************************************************
* Copyright (c) 1987 InterSoft Co.  All Rights Reserved
* THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF InterSoft Co.
* The copyright notice above does not evidence any
* actual or intended publication of such source code.
*
* $Id: rgenlex.l,v 1.5 1997/05/02 19:21:51 eduardoc Exp $
*
* DESCRIPTION
* Lexical Analizer for the FGEN utility. 
*********************************************************************/

#include <ideafix.h>
#include <cfix.h>
#include <ideafix/priv/gndefs.h>
#include <ideafix/priv/opers.h>
#include <ideafix/priv/dbdefs.h>
// #include <ideafix/priv/fmdefs.h>
#include <ideafix/priv/reprep.h>
#include "rgen.h"
#include "rgenpar.h"

#if IDEAWIN
#	define putchar(c) fprintf(stdout,"%c",c)
#	define fputs(s,f) fprintf(f,"%s",s)
#endif

/* +++ CONFIG +++ */
#define TAB	4
/* --- CONFIG --- */

// Variables taken from other modules
extern FILE *yyin;

/* Public variables defined in this module */
Int maxCols = 0;					// Max number of columns in the report

/* Private functions */
#define YYLMAX	500

// Private Global variables
static char buf[0x4000];			// Buffer for a zone image
static int ibuf = 0, column = 0;
static int attr = 0;
static char *ptr = NULL;
static Int lineno = 0;
static struct fld_data f_data;
static int aftzone_lines = 0;

struct keyword {
	char *name;
	short token;
	short state;
};

// ++ Prototypes ++

static int _Cmp(char *a, struct keyword *b);
static short _FindKeyword(char *kwname);
static void blank_f_data(void);
static struct fld_data *save_f_data(void);
static void free_all_mem(void);
static void restoreState(void);
static int resolveExpr(void);
static void beginFlddef(char *zone_name);
static char *str_save(char *s);

// -- Prototypes --

// Constants
#define FLDDEF_STATE		1
#define ZDEF_STATE			2
#define RPDEF_STATE			4
#define FLDDEC_STATE		8
#define EXPR_STATE			16
static UShort state = 0;
static UShort oldState = 0;

#undef yywrap
%}

/* Lex Macros */
delim		[ \t\f\r]
ws			{delim}+
letter		[A-Za-z_]
digit		[0-9]
chr			'.'
id			{letter}({letter}|{digit})*
number		{digit}+

%s FLDDEF ZDEF RPDEF FLDDEC EXPR

%%
<ZDEF>__\/__\/___?_?  {
						blank_f_data();
						f_data.type = TY_DATE;
						f_data.length = (short)yyleng;
						rgenpar_lval.pf_data = save_f_data();
						column += yyleng;
						return T_FIELD;
					}
<ZDEF>__:__(:__)?	{
						blank_f_data();
						f_data.type = TY_TIME;
						f_data.length = (short)yyleng;
						rgenpar_lval.pf_data = save_f_data();
						column += yyleng;
						return T_FIELD;
					}
<ZDEF>-?_*______e	{
						blank_f_data();
						f_data.type = TY_FLOAT;
						f_data.length = (short) yyleng;
						f_data.has_sign = (*yytext == '-');
						rgenpar_lval.pf_data = save_f_data();
						column += yyleng;
						return T_FIELD;
					}
<ZDEF>-?_*______f	{
						blank_f_data();
						f_data.type = TY_FLOAT;
						f_data.length = (short) yyleng;
						f_data.has_sign = (*yytext == '-');
						f_data.doRound = TRUE;
						rgenpar_lval.pf_data = save_f_data();
						column += yyleng;
						return T_FIELD;
					}
<ZDEF>_+\?			{
						blank_f_data();
						f_data.type = TY_BOOL;
						f_data.length = (short) yyleng;
						rgenpar_lval.pf_data = save_f_data();
						column += yyleng;
						return T_FIELD;
					}
<ZDEF>-?((_?_?_(",___")+)|(_+))((\._*)|(\.\#))  {
						int nl;
						blank_f_data();
						f_data.ndec = -1;
						column += yyleng;

						for (ptr = yytext;
								(char *) ptr - (char *) yytext < yyleng;
								++ptr)
							switch (*ptr) {
							case '_' :
								++f_data.length;
								if (f_data.ndec >= 0) f_data.ndec++;
								break;
							case '-' :
								f_data.has_sign = 1;
								break;
							case '.' :
								f_data.ndec = 0;
								++f_data.length;
								break;
							case ',' : 
								f_data.comma = 1;
								break;
							case '#' : 
								f_data.chk_digit = RP_CDIGIT_SLASH;
								break;
							}

						/* If no dec, decrement length (we count '.') */
						if (f_data.ndec == 0)
							f_data.length--;

						/* Calculate type len now (don't consider sign) */
						nl = f_data.length - (f_data.ndec > 0);

						/* If sign, add one place for it */
						if (f_data.has_sign) f_data.length++;

						/* Assign type */
						f_data.type = TY_NUMERIC;

						rgenpar_lval.pf_data = save_f_data();
						return T_FIELD;
					}
<ZDEF>_+			{
						blank_f_data();
						f_data.type = TY_STRING;
						f_data.length = (short) yyleng;
						rgenpar_lval.pf_data = save_f_data();
						column += yyleng;
						return T_FIELD;
					}
<ZDEF>\\\$({letter}|{digit})+ {
						int chr, len = yyleng;

						column += yyleng;
						while ((chr = yyinput()) == ' ' || chr == '\t') {
							do {
								len++;
								column++;
							} while (chr == '\t' && column % TAB);
						}
						unput(chr);
						if (chr == '\n')
#if HAVE_LEX_DIFF_BEHAVIOR
							strcpy(buf + ibuf, "%${");
#else
							sprintf(buf + ibuf, "%%${");
#endif
						else
							sprintf(buf + ibuf, "%%-%d.%d${",
									len, len);
						ibuf = strlen(buf);

						if (isdigit((UChar) yytext[2]))
							sprintf(buf + ibuf, "argv_%d}",
									atoi(yytext+2));
						else {
#if HAVE_LEX_DIFF_BEHAVIOR
							strncpy(buf+ibuf, yytext +2, yyleng - 2);
							buf[ibuf+yyleng -2] = 0;
							strcat (buf+ibuf, "}");
#else
							sprintf(buf + ibuf, "%s}", yytext + 2);
#endif
						}
						ibuf = strlen(buf);
					}
<ZDEF>\n			{
					    attr = 0;
						++lineno;
						buf[ibuf++] = '\n';
						f_data.nlines++;
						if (maxCols < column)
							maxCols = column;
						column = 0;
					}
<ZDEF>\t			{ 
						do {
							buf[ibuf++] = ' ';
							column++;
						} while( column % TAB );
					}
<ZDEF>\\.			{ 	
						if (yytext[1] == '%') buf[ibuf++] = '%';
						buf[ibuf++] = yytext[1];
						column++;
					}
<ZDEF>.				{ 
						if (yytext[0] == '%') buf[ibuf++] = '%';
						buf[ibuf++] = yytext[0];
						column++;
					}

<ZDEF>^%report      { 
						BEGIN(RPDEF); 
						state = RPDEF_STATE;
						return T_BEGRPDEF;
					}

<ZDEF,RPDEF>^%fields {
						BEGIN(FLDDEC);
						state = FLDDEC_STATE;
						return T_BEGFLDDEC;
					}

<ZDEF>^%{id} 		{
						beginFlddef(yytext+1);
						return T_ID;
					}

<FLDDEF>\n			{ 
						BEGIN(ZDEF);
						state = ZDEF_STATE;
						++lineno; 
						return '\n';
					}
<FLDDEF>"//"		{ 
						int c;

						BEGIN(ZDEF);
						state = ZDEF_STATE;
						while ((c = yyinput()) != '\n' && c)
							;
						++lineno;
						return '\n';
					}
<FLDDEF>\\\n		{ 
						++lineno; 
					}

<FLDDEF,RPDEF,FLDDEC>{ws}	{ }

<FLDDEF,RPDEF,FLDDEC>[$=,;().:]	{ return yytext[0];}

<FLDDEF,RPDEF,FLDDEC>{number} {
						rgenpar_lval.strval = str_save(yytext);
						return T_NUMBER;
					}

<FLDDEF,RPDEF,FLDDEC>\" 	{
						int chr, i = 1;
						char buff[4096];
						
						buff[0] = '\"';
						
						while ((chr = yyinput()) != '"'	
								|| buff[i-1] == '\\') {

							if (chr == '"')
								i--;
							buff[i++] = chr;
						}
						buff[i] = '\0';
						StrDecode((UChar *) buff+1, (UChar *) buff+1);
						rgenpar_lval.strval = str_save(buff+1);
						return T_STRING;
					}

<FLDDEF,RPDEF,FLDDEC>"/*"	{
						int c;
						while (c = yyinput()) {
							if (c == '*') {
								if ((c = yyinput()) == '/')
									break;
								unput(c);
							}
							else if (c == '\n') ++lineno;
						}
						if (c == 0) rgen_warn("UNCL_COMM");
					}

<RPDEF,FLDDEC>\n	{ ++lineno; }

<RPDEF,FLDDEC>"//"	{ 
						int c; 
						while ((c = yyinput()) != '\n' && c )
							; 
						if (c == '\n') unput('\n');
					}

<RPDEF>to{ws}printer {
						return T_TOPRINTER;
					} 

<RPDEF>to{ws}term(inal)? {
						return T_TOTERMINAL;
					} 

<RPDEF>to{ws}pipe {
						return T_TOPIPE;
					}

<RPDEF>to{ws}stdout {
						return T_TOSTDOUT;
					}

<RPDEF>from{ws}term(inal)? {
						return T_FROMTERMINAL;
					}

<RPDEF>from{ws}pipe {
						return T_FROMPIPE;
					}

<FLDDEF,RPDEF,FLDDEC>{id} 	{
						short token = _FindKeyword(yytext);

						if (token != ERROR) return token;
						if (strlen(yytext) > MAX_ID_CHARS) {
							rgen_error("NM_TOO_LONG", MAX_ID_CHARS);
							/* Truncate identifiers */
							yytext[MAX_ID_CHARS] = '\0';
						}

						rgenpar_lval.strval = str_save(yytext);
						return T_ID;
					}

<FLDDEF,RPDEF,FLDDEC>.	{
						int chr = yytext[0];
						if (chr >=' ') rgen_error("CHAR", chr);
						else		   rgen_error("OCHAR", chr);
						return chr;
					}

^%{id}				{
						beginFlddef(yytext+1);
						return T_ID;
					}

<EXPR>.				{
						unput(yytext[0]);
						restoreState();
						return resolveExpr();
					}

\n					{ ++lineno; }

.					{ 
						int c;
fprintf(stderr, "******* Read character '%c' (%d)\n", yytext[0], yytext[0]);
						rgen_error("ILL_TEXT");
						while ((c = yyinput()) != '\n' && c)
							; 
						if (c == '\n') unput('\n');
					}
%%

void beginExpression(void)
{
	oldState = state;
	BEGIN(EXPR);
	state = EXPR_STATE;
}

static void beginFlddef(char *zone_name)
{
	BEGIN(FLDDEF);
	state = FLDDEF_STATE;
	rgenpar_lval.strval = str_save(zone_name);
}

/*
 * Leave all things OK in order to lex the next file.
 */
int yywrap(void)
{
	free_all_mem();
	attr = 0L;
	ibuf = column = 0;
	maxCols = 0;
	ptr = NULL;
	aftzone_lines = 0;

	BEGIN(0);
	state = 0;
	oldState = 0;

	return TRUE;
}

#define HAVE_FLEX_MEMMAN	1

#ifndef HAVE_FLEX_MEMMAN
static void *yy_flex_alloc(int size)
{
	return (void *) malloc(SizeT(size));
}

static void *yy_flex_realloc(void *p, int size)
{
	return (void *) realloc(p, SizeT(size));
}

static void yy_flex_free(void *p)
{
	free(p);
}
#endif

/******************* Strings saving routines ***********************/

static struct savelst {
	struct savelst *next;
	char buff[1];
} *first = NULL, *last;

// Saves a String and return a pointer to it.
static char *str_save(char *s)
{
	int n = strlen(s) + 1;
	last = (struct savelst *) Alloc(sizeof(struct savelst *)+n);
	last->next = first;
	first = last;
	strcpy(last->buff, s);
	return last->buff;
}

/* Free all string memory allocated */
static void free_all_mem(void)
{
	while (first != NULL) {
		last = first;
		first = first->next;
		free(last);
	}
	first = last = NULL;
}

/* Return input file line number */
Int rgenLineNo(void)
{
	return lineno;
}

/* Set the line number (for Error messages)	*/
void rgenLineNo(Int n)
{
	lineno = n;
}

/*********** FIELD DATA HANDLING ******************************/

/* Blank the structure to begin parsing				*/
static void blank_f_data(void)
{
	f_data.length = 0;
	f_data.has_sign	= 0;
	f_data.comma = 0;
	f_data.ndec = 0;
	f_data.doRound = 0;
	f_data.chk_digit = RP_NO_CDIGIT;
}

/* 
 * Save in memory the current values				
 * The string is saved following the structure.
 * (The char[1] def. has place for at least one character
 * so there is no need to count the '\0' ja!)
 *
 * NOTE: All these memory is freed by 'free_formats' in 'rgenrut.c'
 */
static struct fld_data *save_f_data(void)
{
	struct fld_data *pf_data = (struct fld_data*) 
							   Alloc(sizeof(f_data) + strlen(buf));

	/* Copy the data								*/
	*pf_data = f_data;

	/* Now, copy the string							*/
	strcpy(pf_data->text, getZoneText());

	/* Return the saved zone						*/
	return pf_data;
}

/* Return the buffer. */
char *getZoneText(void)
{
	buf[ibuf] = '\0';
	ibuf = 0;
	aftzone_lines = f_data.nlines;
	f_data.nlines = 0;
	return buf;
}

/* Also used for the last characters in zone				*/
Int getTextNLines(void)
{
	return aftzone_lines;
}

/********************** Identifiers Table *******************/

static struct keyword kwtab[] = {
	{ "after",		T_AFTER,		FLDDEF_STATE },
	{ "at",			T_AT,			FLDDEF_STATE },
	{ "before",		T_BEFORE,		FLDDEF_STATE },
	{ "bool",		T_BOOL,			FLDDEC_STATE },
	{ "botmarg",	T_BOTMARG,		RPDEF_STATE },
	{ "char",		T_CHAR,			FLDDEC_STATE },
	{ "check",		T_CHECK,		FLDDEC_STATE },
	{ "date",		T_DATE,			FLDDEC_STATE },
	{ "decimals",	T_DECIMALS,		FLDDEC_STATE },
	{ "digit",		T_DIGIT,		FLDDEC_STATE },
	{ "eject",		T_EJECT,		FLDDEF_STATE },
	{ "fill",		T_FILL,			FLDDEC_STATE },
	{ "flength",	T_FLENGTH,		RPDEF_STATE },
	{ "float",		T_FLOAT,		FLDDEC_STATE },
	{ "formfeed",	T_FORMFEED,		RPDEF_STATE },
	{ "from",		T_FROM,			RPDEF_STATE },
	{ "group",		T_GROUP,		FLDDEF_STATE },
	{ "if",			T_IF,			FLDDEF_STATE },
	{ "input",		T_INPUT,		RPDEF_STATE },
	{ "language",	T_LANGUAGE,		RPDEF_STATE },
	{ "leftmarg",	T_LEFTMARG,		RPDEF_STATE },
	{ "line",		T_LINE,			FLDDEF_STATE },
	{ "mask",		T_MASK,			FLDDEC_STATE },
	{ "no",			T_NO,			RPDEF_STATE|FLDDEF_STATE|FLDDEC_STATE },
	{ "null",		T_NULL,			FLDDEC_STATE },
	{ "num",		T_NUM,			FLDDEC_STATE },
	{ "output",		T_OUTPUT,		RPDEF_STATE },
	{ "page",		T_PAGE,			FLDDEF_STATE },
	{ "print",		T_PRINT,		FLDDEF_STATE },
	{ "report",		T_REPORT,		FLDDEF_STATE },
	{ "resetaccum",	T_RESETACCUM,	FLDDEF_STATE },
	{ "time",		T_TIME,			FLDDEC_STATE },
	{ "to",			T_TO,			RPDEF_STATE },
	{ "topmarg",	T_TOPMARG,		RPDEF_STATE },
	{ "use",		T_USE,			RPDEF_STATE },
	{ "width",		T_WIDTH,		RPDEF_STATE },
	{ "with",		T_WITH,			FLDDEF_STATE },
	{ "zeros",		T_ZEROS,		FLDDEC_STATE }
};

static int _Cmp(char *a, struct keyword *b)
{
	return strcmp(a, b->name);
}

static short _FindKeyword(char *kwname)
{

	int i = locate(	kwname, (char*)kwtab, 
					sizeof(kwtab)/sizeof(kwtab[0]), 
					sizeof(kwtab[0]), IFPCPCP(_Cmp));
	return (i>=0 && (kwtab[i].state & state)) ? kwtab[i].token : ERROR;
}

int rgenpar_lex(void)
{
	return yylex();
}

static void restoreState(void)
{
	state = oldState;
	switch (state) {
	case ZDEF_STATE:
		BEGIN(ZDEF);
		break;
	case RPDEF_STATE:
		BEGIN(RPDEF);
		break;
	case FLDDEF_STATE:
		BEGIN(FLDDEF);
		break;
	case FLDDEC_STATE:
		BEGIN(FLDDEC);
		break;
	default:
		BEGIN(0);
		break;
	}
}

#define MAX_EXPR_LEN	1024

static int resolveExpr(void)
{
	int j, i = 0, match = 0, aux = 0;
	bool isstr = FALSE;
	bool done = FALSE;

	char tmpBuff[MAX_EXPR_LEN];
	tmpBuff[i] = yyinput();
	while (!done) {
		switch (tmpBuff[i]) {
		case '\0':
			return FALSE;
		case '\"':
		case '\'':
			if (aux != '\\')
				isstr = !isstr;
			break;
		case ';':
		case ',':
		case ':':
			if (!match && !isstr)
				done = TRUE;
			break;
		case '\n':
			if (aux == '\\')
				i -= 2;
			else if (!match && !isstr)
				done = TRUE;
			break;
		case '(':
			if (!isstr)
				match++;
			break;
		case ')':
			if (!isstr && --match < 0) 
				done = TRUE;
			break;
		}
		if (!done) {
			assert(i < MAX_EXPR_LEN - 1);
			aux = tmpBuff[i];
			tmpBuff[++i] = yyinput();
		}
	}

	for (j = 0; j < i; ++j)
		if (!isspace(tmpBuff[j]))
			break;

	if (j == i)
		return tmpBuff[i];

	unput(tmpBuff[i]);
	tmpBuff[i] = '\0';
	rgenpar_lval.strval = str_save(tmpBuff);
	return T_EXPR;
}

