import { authMockApi } from "./authMock";
import { authAdminApi, IMockAdminApi } from "./authAdmin";
import { Mock } from "..";

export type UserCredential = import("@firebase/auth-types").UserCredential;
export type User = import("@firebase/auth-types").User;
export type AuthSettings = import("@firebase/auth-types").AuthSettings;

export type AuthCredential = import("@firebase/auth-types").AuthCredential;
export type AdditionalUserInfo = import("@firebase/auth-types").AdditionalUserInfo;
export type FirebaseAuth = import("@firebase/auth-types").FirebaseAuth;
export type FirebaseApp = import("@firebase/app-types").FirebaseApp;

export interface IEmailLogin {
  email: string;
  password: string;
}

export interface IMockAuthConfig {
  /**
   * a list of email logins which are already setup as valid
   * in the mock authentication module; this will be used for
   * email logins as well as email links
   */
  validEmailLogins?: IEmailLogin[];
  /** allow anonymous logins */
  allowAnonymous?: boolean;
  /** allow email/password logins */
  allowEmailLogins?: boolean;
  /** allow logins via links sent to email */
  allowEmailLinks?: boolean;
  /** allow logins via a code sent via SMS */
  allowPhoneLogins?: boolean;
}

export type IMockSetup = (mock: Mock) => () => Promise<void>;

export interface IPartialUserCredential {
  additionalUserInfo?: Partial<AdditionalUserInfo>;
  credential?: Partial<AuthCredential> | null;
  operationType?: string | null;
  user?: Partial<User> | null;
}

/**
 * Provides a full FirebaseAuth implementation (although many
 * parts are un-implementated currently) as well as extending
 * to add an "administrative" API for mocking
 */
export interface IMockAuth extends FirebaseAuth, IMockAdminApi {}