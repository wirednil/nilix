export declare enum LoginError {
    INVALID_INPUT = "INVALID_INPUT",
    USER_NOT_FOUND = "USER_NOT_FOUND",
    USER_BLOCKED = "USER_BLOCKED",
    WRONG_PASSWORD = "WRONG_PASSWORD",
    DB_ERROR = "DB_ERROR"
}
export type LoginSuccess = {
    ok: true;
    token: string;
};
export type LoginFailure = {
    ok: false;
    errorCode: LoginError;
    error: string;
};
export type LoginResult = LoginSuccess | LoginFailure;
export declare function login(usuario: string, password: string): Promise<LoginResult>;
export declare function addToBlacklist(jti: string, expiresAt: number): void;
export declare function isBlacklisted(jti: string): boolean;
//# sourceMappingURL=authService.d.ts.map