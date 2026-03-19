#include <ideafix.h>
#include <cfix.h>
#include <ideafix/priv/reprep.h>
#include <ideafix/priv/repexpr.h>
#include <ideafix/priv/gndefs.h>
#include <ideafix/priv/opers.h>
#include <ideafix/priv/dbdefs.h>
#include "rgen.h"

declare(PtrArray, String);
declare(PtrArrayCursor, String);
declare(PtrArray, RpFieldRep);
declare(PtrArrayCursor, RpFieldRep);
declare(PtrArray, RpZoneRep);
declare(PtrArrayCursor, RpZoneRep);
declare(PtrArray, ReportExpr);
declare(PtrArrayCursor, ReportExpr);
declare(PtrArray, RpZoneObject);
declare(PtrArrayCursor, RpZoneObject);
declare(PtrArray, RpAccumulator);
declare(PtrArrayCursor, RpAccumulator);

// Return the order in the report of the specified schema
Int ReportRep::indOfSchema(const String &n) const
{
	idCheck();

	Int i = 0;
	for (PtrArrayCursor(String) curs(schemas_); curs; ++curs, ++i) {
		if (**curs == n)
			return i;
	}
	return ERR;
}

Int ReportRep::addSchema(const String &n)
{
	idCheck();

	return schemas_.add(new String(n));
}

Int ReportRep::add(RpZoneRep *rz)
{
	idCheck();

	return rz->zoneNo_ = zones_.add(rz);
}

void ReportRep::clearOrderFlds()
{
	idCheck();

	forder_.reAlloc(0);
}

Int ReportRep::nOrderFlds() const
{
	idCheck();

	return forder_.dim();
}

Int ReportRep::nextField(RpFieldRep *zexpr)
{
	idCheck();

	for (PtrArrayCursor(RpFieldRep) curs(forder_); curs; ++curs) {
		if (*curs == zexpr)
			return ERR;
	}
	return forder_.add(zexpr);
}

RpZoneRep *ReportRep::zone(const String &zName)
{
	idCheck();

	for (PtrArrayCursor(RpZoneRep) curs(zones_); curs; ++curs) {
		if (curs->name() == zName)
			return *curs;
	}
	return NULL;
}

RpZoneExpr::RpZoneExpr(RpZoneRep *z, const String &exprStr)
:	RpZoneObject(z),
	maske_(*tr_new ReportExpr(z->reportRep())),
	expr_(*tr_new ReportExpr(exprStr, z->reportRep(), z))
{
	initValues();

	if (!expr_) {
		rgen_error("EXPR_SYNTAX_ERR", "zone argument",
				toCharPtr(exprStr));
	} else {
		String sAddr = expr_.symAddress();
		if (!sAddr.isNull() && reportRep()->variableNo(sAddr) == ERR) {
			field_ = reportRep()->field(sAddr);
			// create the RpFieldRep if necessary
			if (field_ == NULL) {
				field_ = tr_new RpFieldRep(reportRep(), sAddr);
				reportRep()->add(field_);
			}
		}
	}
}

RpZoneRep::RpZoneRep(ReportRep *r, const String &str)
:	zobjs_(*tr_new PtrArray(RpZoneObject)(0, 16)),
	flds_(*tr_new PtrArray(RpFieldRep)(0, 4)),
	accs_(*tr_new PtrArray(RpAccumulator)(0, 8)),
	ifexpr_(*tr_new ReportExpr(r, this))
{
	idStart();

	initValues();
	rp_ = r;
	name_ = str;
}

void RpZoneRep::addCondField(RpFieldRep *fr)
{
	idCheck();

	flds_.add(fr);
}

Int RpZoneRep::insert(RpZoneObject *where, RpZoneObject *what)
{
	idCheck();

	Int i = 0;
	for (PtrArrayCursor(RpZoneObject) curs(zobjs_); curs; ++curs, ++i) {
		if (*curs == where) {
			zobjs_.ins(i, what);
			return i;
		}
	}

	return ERR;
}

String RpZoneExpr::descr()
{
	return expr_.getExpr();
}

Int ReportRep::nSchemas() const
{
	idCheck();

	return schemas_.dim();
}

Int ReportRep::add(RpFieldRep *fr)
{
	idCheck();

	return fr->fldNo_ = flds_.add(fr);
}
