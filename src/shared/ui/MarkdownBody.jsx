import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownBody({ className = '', value = '' }) {
  return (
    <div className={['markdown-body', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        components={{
          a: ({ children, href = '', node, ...props }) => {
            void node;

            return (
              <a {...props} href={href} rel="noreferrer noopener" target="_blank">
                {children}
              </a>
            );
          },
          img: ({ alt = '', node, ...props }) => {
            void node;

            return <img {...props} alt={alt} loading="lazy" />;
          },
        }}
        remarkPlugins={[remarkGfm]}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
