/**
 * Copyringht ABC Research GmbH 2022. All rights resereved.
 * 
 * This file contains the grammar definition of orglang
 * used for specifying the orgcharts.
 */
 
{{
export interface Role {
    role: string;
    seniors: string[];
}

export interface RuleHead {
    sign: boolean;
    role: string
}

export interface RuleBodyElement {
    isSelf: boolean;
    isStrict: boolean;
    isRelative: boolean;
    role: string;
    n: number;
}

export interface Rule {
    head: RuleHead | null;
    type: "user-management" | "admin";
    body: RuleBodyElement[];
}

export interface Assignment {
    nominee: string;
    nomineeType: "address" | "parameter";
    role: string;
}

export interface OrgFile {
    header: Header;
    body: Body;
}

export interface Header {
    contractName: string;
    orgChartType: "std" | "dyn"
}

export interface Body {
    roles: Role[];
    rules: Rule[];
    init: Assignment[];
}

export namespace Body {
    export const empty = () => ({roles:[], rules:[], adminRules: [], init: []} as Body);
    export const join = (a: Body, b: Body) => {
        if(!b) return a;
        return {
            roles: [...a.roles, ...b.roles],
            rules: [...a.rules, ...b.rules],
            init: [...a.init, ...b.init]
        } as Body;
    }
}

}}

orgFile = _c header:header _c body:body {
    return {
        header,
        body
    } as OrgFile;
}

// Rules for the orgFile header
header = ":contract" __ contractName:contractName orgChartType:("(" @orgChartType ")") {
    return {
        contractName,
        orgChartType
    } as Header;
}

contractName = $([A-Z][a-zA-Z0-9]*)

orgChartType = "std" / "dyn"

// Rule for the orgFile body
body = _c body:(roleLine / ruleLine  / initLine / adminLine) _c others:body? {
   return Body.join(body, others)
}

roleLine = ":role" __ role:role _ seniors:("(" _ @seniors _")")? {
    const body = Body.empty();
    body.roles.push({
        role,
        seniors: seniors ?? []
    })
    return body;
}

seniors = head:role tail:(_ "," _ @role)* { return [head, ...tail]; }

ruleLine = ruleBody:ruleBody _ "->" _ head:ruleHead {
    const body = Body.empty();
    body.rules.push({
        head,
        type: "user-management",
        body: ruleBody,
    });
    return body;
}

ruleBody = head:ruleBodyElement tail:(_ "," _ @ruleBodyElement)* { return [head, ...tail]}

ruleBodyElement = (self / quantifiedRole)

quantifiedRole = strict:("!")? role:role _ quantity:("(" _ @quantity _ ")")? {
    const [isRelative, n] = quantity ?? [false, 1];
    return {
        isSelf: false,
        isStrict: strict === "!",
        isRelative,
        role,
        n
    } as RuleBodyElement;
}

quantity = quantity:$( $([0-9]+ "%"?) ) {
    let isRelative = false;
    if(quantity.endsWith("%")) {
        isRelative = true;
        quantity = quantity.slice(0, -1);
    }
    return [isRelative, Number(quantity)];
}

self = "self" {
    return {
        isSelf: true,
        isStrict: true,
        isRelative: false,
        role: "self",
        n: 1
    } as RuleBodyElement;
}

ruleHead = sign:"-"? role:role {
    return {
        role,
        sign: sign === "-"
    };
}

initLine = ":init" __ role:role __ nominee:(address/parameter) {
    const body = Body.empty();
    body.init.push({
        nominee,
        nomineeType: nominee.startsWith("0x") ? "address" : "parameter",
        role
    })
    return body;
}

adminLine = ":admin-rule" __ ruleBody:ruleBody {
    const body = Body.empty();
    body.rules.push({
        head: null,
        type: "admin",
        body: ruleBody
    });
    return body;
}

role = $([a-zA-Z][a-zA-Z0-9]*)

comment = "//" [^\n]* "\n"* {return null; }

address = $("0x" [0-9a-fA-F]*)

parameter = ("$" @role)

// Utils

_c = (comment / __ )* 

_  = [ \t\r\n]*

__ = [ \t\r\n]+