function Login() {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:5000/api/auth/google'
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <h1 className="text-3xl font-bold">
          ReachInbox<span className="text-blue-500">.</span>
        </h1>

        <p className="mt-4 text-slate-400">
          Manage and schedule your emails from one place.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="mt-8 w-full rounded-lg bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-200"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-xs text-slate-500">
          Sign in securely using your Google account.
        </p>
      </div>
    </div>
  )
}

export default Login