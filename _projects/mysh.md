---
layout: page
title: MYSH
description: Custom Unix Shell in C
img: assets/img/shell.jpg
importance: 1 
category: work
related_publications: false
---

## Overview                                                                     
                                                                                  
  MYSH is a fully-functional Unix shell implementation written from scratch in C. 
  This project was developed as part of CSC209: Software Tools and Systems        
  Programming at the University of Toronto, with the goal of demystifying what    
  happens behind the scenes when users interact with a command-line interface. By 
  building a shell from the ground up, I gained hands-on experience with fundamental
   operating systems concepts including process creation, inter-process           
  communication, memory management, and system-level programming.                 
                                                                                  
  ## Features                                                                     
                                                                                  
  MYSH implements a comprehensive set of shell functionality:                     
                                                                                  
  ### Core Command Execution                                                      
  - **Built-in Commands**: Custom implementations of `cd`, `exit`, `pwd`, `echo`, 
  and `logfile` for shell control and navigation                                  
  - **External Commands**: Full support for executing any Unix command through    
  `fork()` and `exec()` system calls                                              
  - **PATH Resolution**: Intelligent searching through environment variables to   
  locate and execute binaries                                                     
                                                                                  
  ### I/O Redirection                                                             
  - **Output Redirection (`>` and `>>`)**: Redirect stdout to files, with support 
  for both overwrite and append modes                                             
  - **Input Redirection (`<`)**: Read input from files instead of stdin           
  - **Combined Redirection**: Seamlessly handle multiple redirection operators in a 
  single command line                                                             
                                                                                  
  ### Pipelines                                                                   
  - **Multi-stage Pipes**: Chain multiple commands together using the pipe operator 
  (`|`)                                                                           
  - **Proper Process Coordination**: Create child processes with correctly linked 
  file descriptors for efficient inter-process communication                      
                                                                                  
  ### Background Processing                                                       
  - **Background Jobs (`&`)**: Execute commands asynchronously without blocking the 
  shell                                                                           
  - **Job Management**: Track and manage background processes throughout the shell 
  session                                                                         
                                                                                  
  ### Signal Handling                                                             
  - **Ctrl+C (SIGINT)**: Gracefully handle interrupts, forwarding signals to      
  foreground processes only                                                       
  - **Ctrl+Z (SIGTSTP)**: Implement process suspension and resumption capabilities  
                                  
  ### Additional Features                                                           
  - **Tab Completion**: Navigate and autocomplete directory and file names (where 
  implemented)
  - **Environment Variables**: Dynamic access to shell and user environment
  - **Error Handling**: Robust error messages and graceful failure handling for
  invalid commands or system call failures

  ## Technical Implementation

  ### Process Management

  The heart of MYSH lies in its process management. Every external command execution
   involves:

  ```c
  pid_t pid = fork();
  if (pid == 0) {
      // Child process: execute the command
      execvp(command, args);
      exit(1);
  } else if (pid > 0) {
      // Parent process: wait or continue
      if (!background) {
          waitpid(pid, &status, 0);
      }
  }

  This fork()-exec() pattern is fundamental to Unix process creation, allowing the
  shell to spawn new processes while maintaining control over its own execution.

  Pipe Implementation

  Pipes are implemented using the pipe() system call combined with careful file
  descriptor manipulation:

  int pipefd[2];
  pipe(pipefd);

  // In the first child (writes to pipe)
  dup2(pipefd[1], STDOUT_FILENO);
  close(pipefd[0]);

  // In the second child (reads from pipe)
  dup2(pipefd[0], STDIN_FILENO);
  close(pipefd[1]);

  The dup2() system call redirects the standard input/output streams to the pipe
  ends, enabling seamless data flow between processes.

  Signal Handling

  Proper signal handling ensures that Ctrl+C only affects the foreground child
  process, not the shell itself:

  signal(SIGINT, SIG_IGN);  // Ignore in shell
  // Forward SIGINT to foreground process group
  kill(-foreground_pid, SIGINT);

  Challenges and Solutions

  1. Memory Management

  Managing dynamically allocated strings for command parsing required careful
  attention to prevent memory leaks. I implemented consistent cleanup routines and
  used tools like Valgrind to verify proper memory allocation and deallocation.

  2. Zombie Processes

  Background processes could become zombies if not properly reaped. I addressed this
   by implementing signal handlers for SIGCHLD and using waitpid() with the WNOHANG
  option to clean up terminated background jobs without blocking the shell.

  3. Parsing Complex Commands

  Parsing commands with multiple pipes, redirections, and background operators
  required a robust tokenizer. I developed a recursive descent parser that breaks
  down command lines into an abstract syntax tree, which is then traversed to
  execute the command sequence.

  4. File Descriptor Management

  When implementing pipes and redirection, ensuring file descriptors are properly
  closed in both parent and child processes was critical. Leaving file descriptors
  open could lead to deadlocks or resource exhaustion.

  What I Learned

  Building MYSH provided deep insights into:

  - System Calls: First-hand experience with fork(), exec(), wait(), pipe(), dup2(),
   and signal handling functions
  - Process Lifecycle: Understanding the complete lifecycle of Unix processes from
  creation to termination
  - Inter-Process Communication: How processes exchange data through pipes and how
  the shell coordinates this communication
  - C Programming: Advanced C concepts including pointers, memory allocation, string
   manipulation, and low-level I/O
  - Debugging Techniques: Using gdb for debugging, strace for tracing system calls,
  and Valgrind for memory analysis
  - Unix Philosophy: Understanding the design principles that make Unix shells
  powerful composable tools

  Future Enhancements

  Possible extensions for MYSH include:
  - Command history with arrow key navigation
  - Tab completion for commands and file paths
  - Shell scripting with variables and control flow
  - Job control commands (fg, bg, jobs)
  - Globbing and wildcard expansion

  MYSH represents a significant milestone in my systems programming journey. It
  transformed abstract concepts about operating systems into concrete, working code.
   The project not only strengthened my technical skills but also gave me a profound
   appreciation for the elegance and simplicity of Unix design principles.

```

{% endraw %}
