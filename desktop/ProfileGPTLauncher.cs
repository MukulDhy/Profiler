using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

/// <summary>
/// Tiny native launcher for the portable ProfileGPT build.
///
/// It starts the bundled Node runtime with `launcher.js` and exits, so the user
/// gets a single-click `ProfileGPT.exe` without a console window. Everything
/// else (servers, logs, config watching, browser) lives in launcher.js.
/// </summary>
internal static class ProfileGptLauncher
{
    [STAThread]
    private static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(root, "launcher.js");
        string node = Path.Combine(root, "runtime", "node.exe");

        if (!File.Exists(script))
        {
            MessageBox.Show(
                "launcher.js is missing. Extract the whole ZIP before running ProfileGPT.",
                "ProfileGPT",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        if (!File.Exists(node))
        {
            // Development fallback: rely on node being on PATH.
            node = "node.exe";
        }

        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = node,
                Arguments = "\"" + script + "\"",
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            startInfo.EnvironmentVariables["PROFILEGPT_LAUNCHER_ROOT"] = root;

            Process.Start(startInfo);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "ProfileGPT could not start.\n\n" + error.Message +
                "\n\nSee logs\\launcher.log for details.",
                "ProfileGPT",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}
