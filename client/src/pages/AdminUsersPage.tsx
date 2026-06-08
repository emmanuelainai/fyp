import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import type { Role, User } from "../types";
import { departments } from "../utils/departments";
import { formatDateTime } from "../utils/time";

export const AdminUsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    usersApi
      .list()
      .then((response) => setUsers(response.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateUser = async (id: string, data: Partial<User>) => {
    setError("");
    try {
      const response = await usersApi.update(id, data);
      setUsers((current) => current.map((user) => (user.id === id ? response.data : user)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">User management</h1>
        <p className="mt-1 text-sm text-slate-500">Admins can manage roles and deactivate accounts.</p>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{user.name}</p>
                    <p className="text-slate-500">{user.email}</p>
                    <p className="text-xs text-slate-400">{user.matricNumber ?? "No matric number"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select className="focus-ring rounded-md border border-slate-300 px-2 py-1.5" value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as Role })}>
                      <option value="STUDENT">Student</option>
                      <option value="EXAMINER">Examiner</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {user.role === "STUDENT" ? (
                      <select
                        className="focus-ring min-w-48 rounded-md border border-slate-300 px-2 py-1.5"
                        value={user.department ?? ""}
                        onChange={(event) => updateUser(user.id, { department: event.target.value || null })}
                      >
                        <option value="">No department</option>
                        {departments.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400">Not applicable</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      className={`focus-ring rounded-md px-3 py-1.5 text-xs font-semibold ${
                        user.isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
