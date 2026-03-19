/* A Bison parser, made by GNU Bison 2.7.  */

/* Bison interface for Yacc-like parsers in C
   
      Copyright (C) 1984, 1989-1990, 2000-2012 Free Software Foundation, Inc.
   
   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.
   
   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
   
   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.  */

/* As a special exception, you may create a larger work that contains
   part or all of the Bison parser skeleton and distribute that work
   under terms of your choice, so long as that work isn't itself a
   parser generator using the skeleton or a modified version thereof
   as a parser skeleton.  Alternatively, if you modify or redistribute
   the parser skeleton itself, you may (at your option) remove this
   special exception, which will cause the skeleton and the resulting
   Bison output files to be licensed under the GNU General Public
   License without this special exception.
   
   This special exception was added by the Free Software Foundation in
   version 2.2 of Bison.  */

#ifndef YY_RGENPAR_Y_TAB_H_INCLUDED
# define YY_RGENPAR_Y_TAB_H_INCLUDED
/* Enabling traces.  */
#ifndef YYDEBUG
# define YYDEBUG 0
#endif
#if YYDEBUG
extern int rgenpar_debug;
#endif

/* Tokens.  */
#ifndef YYTOKENTYPE
# define YYTOKENTYPE
   /* Put the tokens into the symbol table, so that GDB and other debuggers
      know about them.  */
   enum yytokentype {
     T_USE = 258,
     T_LEFTMARG = 259,
     T_WIDTH = 260,
     T_TOPRINTER = 261,
     T_INPUT = 262,
     T_MASK = 263,
     T_BEFORE = 264,
     T_AFTER = 265,
     T_IF = 266,
     T_FROM = 267,
     T_RESETACCUM = 268,
     T_GROUP = 269,
     T_WITH = 270,
     T_LINE = 271,
     T_EJECT = 272,
     T_REPORT = 273,
     T_PAGE = 274,
     T_BEGRPDEF = 275,
     T_BEGFLDDEC = 276,
     T_FLENGTH = 277,
     T_BOTMARG = 278,
     T_TOPMARG = 279,
     T_NULL = 280,
     T_ZEROS = 281,
     T_OUTPUT = 282,
     T_TO = 283,
     T_TOPIPE = 284,
     T_NO = 285,
     T_FORMFEED = 286,
     T_TOTERMINAL = 287,
     T_PRINT = 288,
     T_FROMTERMINAL = 289,
     T_FROMPIPE = 290,
     T_TOSTDOUT = 291,
     T_AT = 292,
     T_CHECK = 293,
     T_DIGIT = 294,
     T_DECIMALS = 295,
     T_FILL = 296,
     T_NUM = 297,
     T_FLOAT = 298,
     T_BOOL = 299,
     T_DATE = 300,
     T_TIME = 301,
     T_CHAR = 302,
     T_STRING = 303,
     T_ID = 304,
     T_NUMBER = 305,
     T_EXPR = 306,
     T_LANGUAGE = 307,
     T_FIELD = 308
   };
#endif
/* Tokens.  */
#define T_USE 258
#define T_LEFTMARG 259
#define T_WIDTH 260
#define T_TOPRINTER 261
#define T_INPUT 262
#define T_MASK 263
#define T_BEFORE 264
#define T_AFTER 265
#define T_IF 266
#define T_FROM 267
#define T_RESETACCUM 268
#define T_GROUP 269
#define T_WITH 270
#define T_LINE 271
#define T_EJECT 272
#define T_REPORT 273
#define T_PAGE 274
#define T_BEGRPDEF 275
#define T_BEGFLDDEC 276
#define T_FLENGTH 277
#define T_BOTMARG 278
#define T_TOPMARG 279
#define T_NULL 280
#define T_ZEROS 281
#define T_OUTPUT 282
#define T_TO 283
#define T_TOPIPE 284
#define T_NO 285
#define T_FORMFEED 286
#define T_TOTERMINAL 287
#define T_PRINT 288
#define T_FROMTERMINAL 289
#define T_FROMPIPE 290
#define T_TOSTDOUT 291
#define T_AT 292
#define T_CHECK 293
#define T_DIGIT 294
#define T_DECIMALS 295
#define T_FILL 296
#define T_NUM 297
#define T_FLOAT 298
#define T_BOOL 299
#define T_DATE 300
#define T_TIME 301
#define T_CHAR 302
#define T_STRING 303
#define T_ID 304
#define T_NUMBER 305
#define T_EXPR 306
#define T_LANGUAGE 307
#define T_FIELD 308



#if ! defined YYSTYPE && ! defined YYSTYPE_IS_DECLARED
typedef union YYSTYPE
{
/* Line 2058 of yacc.c  */
#line 54 "rgenpar.y"

	int ival;
	char *strval;
	struct fld_data *pf_data;
	Int f_type;


/* Line 2058 of yacc.c  */
#line 171 "y.tab.h"
} YYSTYPE;
# define YYSTYPE_IS_TRIVIAL 1
# define yystype YYSTYPE /* obsolescent; will be withdrawn */
# define YYSTYPE_IS_DECLARED 1
#endif

extern YYSTYPE rgenpar_lval;

#ifdef YYPARSE_PARAM
#if defined __STDC__ || defined __cplusplus
int rgenpar_parse (void *YYPARSE_PARAM);
#else
int rgenpar_parse ();
#endif
#else /* ! YYPARSE_PARAM */
#if defined __STDC__ || defined __cplusplus
int rgenpar_parse (void);
#else
int rgenpar_parse ();
#endif
#endif /* ! YYPARSE_PARAM */

#endif /* !YY_RGENPAR_Y_TAB_H_INCLUDED  */
