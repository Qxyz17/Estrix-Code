//! shell 原语单元测试

#[cfg(test)]
mod tests {
    use crate::shell::exec::{execute_command, CommandRequest, ShellKind};

    fn cmd(command: &str) -> CommandRequest {
        CommandRequest {
            command: command.to_string(),
            workdir: None,
            timeout_ms: Some(10000),
            detached: false,
            shell: Some(ShellKind::Cmd),
        }
    }

    #[tokio::test]
    async fn test_echo() {
        let r = execute_command(cmd("echo hello"), None).await;
        assert!(r.success, "应成功: {:?}", r);
        assert!(r.stdout.contains("hello"), "stdout 应含 hello: {:?}", r.stdout);
    }

    #[tokio::test]
    async fn test_exit_code_nonzero() {
        let r = execute_command(cmd("exit 3"), None).await;
        assert!(!r.success);
        assert_eq!(r.exit_code, Some(3));
        assert!(r.output.contains("[exit code: 3]"), "应含标记: {}", r.output);
    }

    #[tokio::test]
    async fn test_stderr() {
        let r = execute_command(cmd("echo err 1>&2"), None).await;
        assert!(r.output.contains("[stderr]"), "应含 stderr 标记: {}", r.output);
    }

    #[tokio::test]
    async fn test_timeout() {
        let mut req = cmd("ping -n 20 127.0.0.1 >nul");
        req.timeout_ms = Some(1500);
        let r = execute_command(req, None).await;
        assert!(r.timed_out, "应超时: {:?}", r);
        assert!(r.output.contains("[timed out after 1500ms]"));
    }

    #[tokio::test]
    async fn test_empty_output() {
        let r = execute_command(cmd("ver >nul"), None).await;
        assert_eq!(r.stdout.trim(), "");
    }
}
