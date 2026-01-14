export const SparklesIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
  >
    <path
      d="M2.5 0.5V0H3.5V0.5C3.5 1.60457 4.39543 2.5 5.5 2.5H6V3V3.5H5.5C4.39543 
        3.5 3.5 4.39543 3.5 5.5V6H3H2.5V5.5C2.5 4.39543 1.60457 3.5 0.5 
        3.5H0V3V2.5H0.5C1.60457 2.5 2.5 1.60457 2.5 0.5Z"
      fill="currentColor"
    />
    <path
      d="M14.5 4.5V5H13.5V4.5C13.5 3.94772 13.0523 3.5 12.5 3.5H12V3V2.5H12.5C13.0523 
        2.5 13.5 2.05228 13.5 1.5V1H14H14.5V1.5C14.5 2.05228 14.9477 2.5 15.5 
        2.5H16V3V3.5H15.5C14.9477 3.5 14.5 3.94772 14.5 4.5Z"
      fill="currentColor"
    />
    <path
      d="M8.40706 4.92939L8.5 4H9.5L9.59294 4.92939C9.82973 7.29734 11.7027 
        9.17027 14.0706 9.40706L15 9.5V10.5L14.0706 10.5929C11.7027 10.8297 
        9.82973 12.7027 9.59294 15.0706L9.5 16H8.5L8.40706 15.0706C8.17027 
        12.7027 6.29734 10.8297 3.92939 10.5929L3 10.5V9.5L3.92939 
        9.40706C6.29734 9.17027 8.17027 7.29734 8.40706 4.92939Z"
      fill="currentColor"
    />
  </svg>
);

export const ArrowUpIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: 'currentcolor', ...props.style }}
    viewBox="0 0 16 16"
    width={size}
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M8.70711 1.39644C8.31659 1.00592 7.68342 1.00592 7.2929 1.39644L2.21968 
        6.46966L1.68935 6.99999L2.75001 8.06065L3.28034 7.53032L7.25001 
        3.56065V14.25V15H8.75001V14.25V3.56065L12.7197 7.53032L13.25 
        8.06065L14.3107 6.99999L13.7803 6.46966L8.70711 1.39644Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const StopIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg
    height={size}
    style={{ color: 'currentcolor', ...props.style }}
    viewBox="0 0 16 16"
    width={size}
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M3 3H13V13H3V3Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const MessageIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
  >
    <path
      clipRule="evenodd"
      d="M2.8914 10.4028L2.98327 10.6318C3.22909 11.2445 3.5 12.1045 3.5 
        13C3.5 13.3588 3.4564 13.7131 3.38773 14.0495C3.69637 13.9446 
        4.01409 13.8159 4.32918 13.6584C4.87888 13.3835 5.33961 13.0611 
        5.70994 12.7521L6.22471 12.3226L6.88809 12.4196C7.24851 12.4724 
        7.61994 12.5 8 12.5C11.7843 12.5 14.5 9.85569 14.5 7C14.5 4.14431 
        11.7843 1.5 8 1.5C4.21574 1.5 1.5 4.14431 1.5 7C1.5 8.18175 
        1.94229 9.29322 2.73103 10.2153L2.8914 10.4028ZM2.8135 15.7653C1.76096 
        16 1 16 1 16C1 16 1.43322 15.3097 1.72937 14.4367C1.88317 13.9834 
        2 13.4808 2 13C2 12.3826 1.80733 11.7292 1.59114 11.1903C0.591845 
        10.0221 0 8.57152 0 7C0 3.13401 3.58172 0 8 0C12.4183 0 16 3.13401 
        16 7C16 10.866 12.4183 14 8 14C7.54721 14 7.10321 13.9671 6.67094 
        13.9038C6.22579 14.2753 5.66881 14.6656 5 15C4.23366 15.3832 
        3.46733 15.6195 2.8135 15.7653Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const CrossIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
  >
    <path
      clipRule="evenodd"
      d="M12.4697 13.5303L13 14.0607L14.0607 13L13.5303 12.4697L9.06065 
        7.99999L13.5303 3.53032L14.0607 2.99999L13 1.93933L12.4697 
        2.46966L7.99999 6.93933L3.53032 2.46966L2.99999 1.93933L1.93933 
        2.99999L2.46966 3.53032L6.93933 7.99999L2.46966 12.4697L1.93933 
        13L2.99999 14.0607L3.53032 13.5303L7.99999 9.06065L12.4697 13.5303Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const ArrowDownIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
  >
    <path
      clipRule="evenodd"
      d="M7.29289 14.6036C7.68342 14.9941 8.31658 14.9941 8.70711 
        14.6036L13.7803 9.53033L14.3107 9L13.25 7.93934L12.7197 
        8.46967L8.75 12.4393V1.75V1H7.25V1.75V12.4393L3.28033 
        8.46967L2.75 7.93934L1.68934 9L2.21967 9.53033L7.29289 14.6036Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const RefreshIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M2.5 8a5.5 5.5 0 0 1 9.3-4M13.5 8a5.5 5.5 0 0 1-9.3 4"
      strokeLinecap="round"
    />
    <path d="M10.5 4.5L12 3l1.5 1.5M5.5 11.5L4 13l-1.5-1.5" />
  </svg>
);

export const MaximizeIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M9.5 1.5H14.5V6.5M6.5 14.5H1.5V9.5M14 2L9.5 6.5M2 14L6.5 9.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MinimizeIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M14 6.5H9.5V2M2 9.5H6.5V14M9 6.5L14.5 1M6.5 9.5L1 15"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CopyIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <rect x="5.5" y="5.5" width="8" height="9" rx="1" />
    <path
      d="M10.5 5.5V3.5C10.5 2.94772 10.0523 2.5 9.5 2.5H3.5C2.94772 
        2.5 2.5 2.94772 2.5 3.5V11.5C2.5 12.0523 2.94772 12.5 3.5 12.5H5.5"
      strokeLinecap="round"
    />
  </svg>
);

export const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 8L6.5 11.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RegenerateIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M1.5 8a6.5 6.5 0 0 1 11.5-4.2M14.5 8a6.5 6.5 0 0 1-11.5 4.2"
      strokeLinecap="round"
    />
    <path
      d="M11.5 3.5V1M11.5 3.5H14M4.5 12.5V15M4.5 12.5H2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
