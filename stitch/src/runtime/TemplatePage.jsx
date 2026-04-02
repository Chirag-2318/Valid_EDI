import { useEffect, useRef } from 'react';

const MANAGED_ATTR = 'data-react-template-managed';

function clearManagedHeadNodes() {
  const managed = document.head.querySelectorAll(`[${MANAGED_ATTR}="true"]`);
  managed.forEach((node) => node.remove());
}

function applyHtmlAttributes(sourceHtml) {
  if (!sourceHtml) {
    return;
  }

  const target = document.documentElement;

  if (sourceHtml.getAttribute('lang')) {
    target.setAttribute('lang', sourceHtml.getAttribute('lang'));
  }

  target.className = sourceHtml.className;
}

function applyBodyAttributes(sourceBody) {
  if (!sourceBody) {
    return;
  }

  const target = document.body;

  for (const attr of Array.from(target.attributes)) {
    if (attr.name === 'id') {
      continue;
    }
    target.removeAttribute(attr.name);
  }

  for (const attr of Array.from(sourceBody.attributes)) {
    target.setAttribute(attr.name, attr.value);
  }
}

function createExecutableScript(sourceScript) {
  const script = document.createElement('script');

  for (const attr of Array.from(sourceScript.attributes)) {
    script.setAttribute(attr.name, attr.value);
  }

  if (sourceScript.src) {
    script.async = false;
    script.src = sourceScript.src;
  } else {
    script.textContent = sourceScript.textContent || '';
  }

  script.setAttribute(MANAGED_ATTR, 'true');

  return script;
}

async function appendHeadNode(parent, sourceNode) {
  if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tagName = sourceNode.tagName;

  if (tagName === 'TITLE') {
    document.title = sourceNode.textContent || '';
    return;
  }

  if (tagName === 'SCRIPT') {
    const script = createExecutableScript(sourceNode);
    const finished = new Promise((resolve) => {
      if (!script.src) {
        resolve();
        return;
      }

      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => resolve(), { once: true });
    });

    parent.appendChild(script);
    await finished;
    return;
  }

  const clone = sourceNode.cloneNode(true);
  clone.setAttribute(MANAGED_ATTR, 'true');
  parent.appendChild(clone);
}

async function executeBodyScripts(container) {
  const scripts = Array.from(container.querySelectorAll('script'));

  for (const oldScript of scripts) {
    const newScript = createExecutableScript(oldScript);
    const finished = new Promise((resolve) => {
      if (!newScript.src) {
        resolve();
        return;
      }

      newScript.addEventListener('load', () => resolve(), { once: true });
      newScript.addEventListener('error', () => resolve(), { once: true });
    });

    oldScript.replaceWith(newScript);
    await finished;
  }
}

export function TemplatePage({ html }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let canceled = false;

    async function renderTemplate() {
      if (!containerRef.current) {
        return;
      }

      const parser = new DOMParser();
      const parsed = parser.parseFromString(html, 'text/html');

      applyHtmlAttributes(parsed.documentElement);
      applyBodyAttributes(parsed.body);

      containerRef.current.innerHTML = parsed.body.innerHTML;

      clearManagedHeadNodes();
      const headNodes = Array.from(parsed.head.children);
      const scriptNodes = [];
      const otherNodes = [];

      headNodes.forEach((node) => {
        if (node.tagName === 'SCRIPT') {
          scriptNodes.push(node);
        } else {
          otherNodes.push(node);
        }
      });

      for (const node of otherNodes) {
        if (canceled) {
          return;
        }
        await appendHeadNode(document.head, node);
      }

      for (const node of scriptNodes) {
        if (canceled) {
          return;
        }
        await appendHeadNode(document.head, node);
      }

      if (canceled) {
        return;
      }
      await executeBodyScripts(containerRef.current);
    }

    void renderTemplate();

    return () => {
      canceled = true;
      clearManagedHeadNodes();
    };
  }, [html]);

  return <div ref={containerRef} />;
}
