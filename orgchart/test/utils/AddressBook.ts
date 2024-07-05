/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the address book used for keeping
 * track of user-role assignments. This class should only be used
 * for testing purposes.
 */

import { Role, Address } from "./common";

/**
 * Test utility class for keeping track of the user-role assignment
 * of the test instance. Provides some useful tools like composing a
 * set of signers having a certain role.
 */
export class AddressBook {
  private readonly users: string[];
  private readonly role2users: Map<Role, Address[]>;
  private readonly user2roles: Map<Address, Role[]>;

  /**
   * Constructor
   *
   * @param users list of available users (addresses) in the test environment
   */
  public constructor(users: string[]) {
    this.users = users;
    this.role2users = new Map();
    this.user2roles = new Map();
  }

  /**
   * Add a new user-role assignment to the address book.
   * This method will not add the role to the user if it is already
   * assigned to the user (avoid duplicates).
   *
   * @param user user to add
   * @param role role to add
   */
  public add(user: Address, role: Role) {
    let usersOfRole = this.role2users.get(role);
    let rolesOfUser = this.user2roles.get(user);

    if (!usersOfRole) {
      usersOfRole = [];
      this.role2users.set(role, usersOfRole);
    }

    if (!rolesOfUser) {
      rolesOfUser = [];
      this.user2roles.set(user, rolesOfUser);
    }
    if (usersOfRole.findIndex((u) => u == user) < 0) usersOfRole.push(user);
    if (rolesOfUser.findIndex((r) => r == role) < 0) rolesOfUser.push(role);
  }

  /**
   * Remove a user role assignment from the address book.
   * This method will not have any effect if the user does not have
   * the role that should be removed.
   *
   * @param user user form which to remove the address
   * @param role
   */
  public remove(user: Address, role: Role) {
    let usersOfRole = this.role2users.get(role);
    let rolesOfUser = this.user2roles.get(user);

    if (usersOfRole) {
      const i = usersOfRole.findIndex((u) => u == user);
      if (i >= 0) {
        usersOfRole.splice(i, 1);
      }
    }

    if (rolesOfUser) {
      const j = rolesOfUser.findIndex((r) => r == role);
      if (j >= 0) {
        rolesOfUser.splice(j, 1);
      }
    }
  }

  /**
   * Returns a list of addresses that fulfill a passed role profile.
   * This method will throw an error in case the profile cannot be fulfilled using
   * the current address book.
   *
   * @param required list of role-number tuple where the role represents the required role
   *                 and the number the amount of needed users of that role
   * @returns A list of users. Note that the order of users is not arbitrary but is the same as
   *          the order specified by the role profile.
   * @note The address book has no information about the underlying org-chart-structure. Hence
   *       the address book can only consider direct role assignments. Role inheritance is thus
   *       not covered by the address book.
   */
  public getUsersHavingRoles(required: ([Role, number] | Role)[]): Address[] {
    const userSet = new Set<Address>();

    const arr = required
      .map((entry) => {
        let role: Role;
        let n: number;

        if (Array.isArray(entry)) {
          role = entry[0];
          n = entry[1];
        } else {
          role = entry;
          n = 1;
        }

        if (!this.role2users.has(role)) {
          throw new Error(`No entries for role "${role}".`);
        }
        const users = this.role2users.get(role).filter((u) => !userSet.has(u));
        if (users.length < n)
          throw new Error("Not enough entries of specified role");

        const taken = users.slice(0, n);
        taken.forEach((u) => userSet.add(u));
        return taken;
      })
      .reduce((a, b) => [...a, ...b], []);
    return arr;
  }

  /**
   * Returns one user that has the specified role.
   * It will throw an error if no user has the specified role.
   *
   * @param role required role
   * @returns address of user having this role
   * @note The address book has no information about the underlying org-chart-structure. Hence
   *       the address book can only consider direct role assignments. Role inheritance is thus
   *       not covered by the address book.
   * @note In case multiple users have the role, an arbitrary user is designed. There is no guarantee
   *       that the same user is returned every time but also no guarantee, that a particular user having
   *       the required role will be eventually returned.
   */
  public getUserOfRole(role: Role): Address {
    if (!this.role2users.has(role)) throw new Error("No entries for this role");
    return this.role2users.get(role)[0];
  }

  /**
   * Returns all users known to the address book
   *
   * @returns array of user's addresses
   */
  public getAllUsers(): Address[] {
    return this.users;
  }

  /**
   * Returns all users of the address book assigned to a specific role
   * In case on user is assigned to that role, an empty array is returned.
   *
   * @param role required role
   * @returns array of addresses of users having specified role.
   */
  public getAllUsersOfRole(role: Role): Address[] {
    return this.role2users.get(role) ?? [];
  }

  /**
   * Returns a user that is not assigned to any role yet
   * Will throw an error if no unassigned user exist.
   *
   * @returns address of unassigned user
   */
  public getUnassignedUsers(): Address[] {
    const unassigned = this.users.filter((u) => !this.user2roles.has(u));
    if (unassigned.length == 0) {
      throw new Error("No unassigned users available");
    }
    return unassigned;
  }

  /**
   * Returns all users that do not have specific roles
   * In case no such user exists, an empty array is returned
   *
   * @param roles array of roles which should be excluded
   * @returns array of users
   */
  public getAllUsersBut(roles: Role[]): Address[] {
    const allUserRoles = (u: Address) => this.user2roles.get(u) ?? [];
    const excluded = (r: string) => roles.findIndex((role) => role == r) >= 0;
    return this.users.filter((u) => allUserRoles(u).every((r) => !excluded(r)));
  }
}
